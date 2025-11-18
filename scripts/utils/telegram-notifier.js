const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

const fsp = fs.promises;
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
const TELEGRAM_ATTACH_EXECUTION_LOG = process.env.TELEGRAM_ATTACH_EXECUTION_LOG === 'true';
const HAS_FORMDATA_SUPPORT = typeof FormData !== 'undefined' && typeof Blob !== 'undefined';

function isConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const formatted = date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return `${formatted} IST`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatLogSnapshot(entry = {}) {
  const keys = ['action', 'location', 'sessionReused', 'durationMs', 'timestamp'];
  const lines = keys
    .filter((key) => entry[key] !== undefined && entry[key] !== '')
    .map((key) => `${key}: ${entry[key]}`);
  return lines.join('\n');
}

function buildMessage(summary = {}, logEntry = null) {
  const merged = { ...(logEntry || {}), ...summary };
  const statusEmoji = merged.success ? '✅' : '❌';
  const lines = [`${statusEmoji} <b>Automation ${merged.success ? 'Succeeded' : 'Failed'}</b>`];

  const summaryLines = [];
  if (merged.executionId) {
    summaryLines.push(`• <b>ID:</b> <code>${escapeHtml(merged.executionId)}</code>`);
  }
  if (merged.duration) {
    summaryLines.push(`• <b>Duration:</b> ${escapeHtml(merged.duration)}`);
  }
  if (merged.timestamp) {
    summaryLines.push(`• <b>Time:</b> ${escapeHtml(formatTimestamp(merged.timestamp))}`);
  }
  if (summaryLines.length) {
    lines.push('', '<b>Summary</b>', ...summaryLines);
  }

  const detailLines = [];
  if (merged.action) {
    detailLines.push(`• <b>Action:</b> ${escapeHtml(merged.action)}`);
  }
  if (merged.location) {
    detailLines.push(`• <b>Location:</b> ${escapeHtml(merged.location)}`);
  }
  if (merged.sessionReused !== undefined) {
    detailLines.push(`• <b>Session reused:</b> ${merged.sessionReused ? 'Yes' : 'No'}`);
  }
  if (detailLines.length) {
    lines.push('', '<b>Details</b>', ...detailLines);
  }

  if (logEntry) {
    const snapshot = formatLogSnapshot(logEntry);
    if (snapshot) {
      lines.push('', '<b>Log Snapshot</b>', `<pre>${escapeHtml(snapshot)}</pre>`);
    }
  }

  if (!merged.success && merged.error) {
    lines.push('', '<b>Error</b>', `<pre>${escapeHtml(merged.error)}</pre>`);
  }

  if (!merged.success && merged.stack) {
    lines.push('<b>Stack</b>', `<pre>${escapeHtml(merged.stack)}</pre>`);
  }

  return lines.filter(Boolean).join('\n');
}

function getLogFileNameFromTimestamp(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const iso = date.toISOString().slice(0, 10);
  return `execution-${iso}.log`;
}

async function findLogEntryForExecution(summary) {
  try {
    const fileName = getLogFileNameFromTimestamp(summary.timestamp);
    if (!fileName) {
      return null;
    }
    const filePath = path.join(LOGS_DIR, fileName);
    const fileContent = await fsp.readFile(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.executionId === summary.executionId) {
          return parsed;
        }
      } catch (error) {
        logger.warn('Failed to parse execution log line', { error: error.message });
      }
    }
    return null;
  } catch (error) {
    logger.debug('Unable to read execution log for Telegram snapshot', { error: error.message });
    return null;
  }
}

async function sendExecutionLogDocument(summary) {
  if (!TELEGRAM_ATTACH_EXECUTION_LOG || !HAS_FORMDATA_SUPPORT) {
    return { uploaded: false, reason: 'disabled' };
  }

  try {
    const fileName = getLogFileNameFromTimestamp(summary.timestamp);
    if (!fileName) {
      return { uploaded: false, reason: 'no-filename' };
    }
    const filePath = path.join(LOGS_DIR, fileName);
    await fsp.access(filePath);
    const buffer = await fsp.readFile(filePath);
    const form = new FormData();
    form.append('chat_id', process.env.TELEGRAM_CHAT_ID);
    form.append(
      'document',
      new Blob([buffer], { type: 'text/plain' }),
      fileName,
    );
    const captionParts = ['Execution log'];
    if (summary.executionId) {
      captionParts.push(`ID: ${summary.executionId}`);
    }
    form.append('caption', captionParts.join(' - '));

    const endpoint = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('Telegram log attachment failed', {
        status: response.status,
        body: errorText,
      });
      return { uploaded: false, reason: 'api-error' };
    }

    logger.info('Telegram execution log attached', { fileName });
    return { uploaded: true };
  } catch (error) {
    logger.debug('Skipping Telegram log attachment', { error: error.message });
    return { uploaded: false, reason: 'error' };
  }
}

async function sendExecutionNotification(summary) {
  if (!isConfigured()) {
    logger.debug('Telegram notification skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return { delivered: false, reason: 'missing-config' };
  }

  if (typeof globalThis.fetch !== 'function') {
    logger.warn('Telegram notification failed: global fetch is unavailable (requires Node.js 18+)');
    return { delivered: false, reason: 'no-fetch' };
  }

  const logEntry = await findLogEntryForExecution(summary);

  const payload = {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: buildMessage(summary, logEntry),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  const endpoint = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await globalThis.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('Telegram notification API responded with non-200 status', {
        status: response.status,
        body: errorText,
      });
      return { delivered: false, reason: 'api-error' };
    }

    logger.info('Telegram notification delivered');

    await sendExecutionLogDocument(summary);

    return { delivered: true };
  } catch (error) {
    logger.warn('Telegram notification request failed', { error: error.message });
    return { delivered: false, reason: 'request-error' };
  }
}

module.exports = {
  sendExecutionNotification,
  isTelegramConfigured: isConfigured,
};
