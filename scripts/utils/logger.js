/**
 * Centralized logging utility using Winston
 * Provides structured logging with daily rotating files and console output
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Get log retention from environment (default: 14 days)
const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS || '14';

// Custom format for console output (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Custom format for file output (JSON for parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create daily rotate transport for combined logs
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: `${LOG_RETENTION_DAYS}d`,
  format: fileFormat,
  level: 'info',
});

// Create daily rotate transport for error logs
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: `${LOG_RETENTION_DAYS}d`,
  format: fileFormat,
  level: 'error',
});

// Create daily rotate transport for execution summary logs
const executionRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'execution-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: `${LOG_RETENTION_DAYS}d`,
  format: fileFormat,
  level: 'info',
});

// Create the main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    combinedRotateTransport,
    errorRotateTransport,
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: `${LOG_RETENTION_DAYS}d`,
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: `${LOG_RETENTION_DAYS}d`,
      format: fileFormat,
    }),
  ],
});

// Create execution logger for automation run summaries
const executionLogger = winston.createLogger({
  level: 'info',
  transports: [executionRotateTransport],
});

/**
 * Log execution summary for automation runs
 * @param {Object} summary - Execution summary object
 */
function logExecution(summary) {
  executionLogger.info('Execution Summary', summary);
}

/**
 * Generate unique execution ID
 * @returns {string} Execution ID (timestamp-based)
 */
function generateExecutionId() {
  return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

module.exports = {
  logger,
  logExecution,
  generateExecutionId,
  formatDuration,
};
