/**
 * Video cleanup utility
 * Removes video recordings older than specified retention period
 */

const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

const videosDir = path.join(__dirname, '..', '..', 'videos');

/**
 * Get video retention period from environment (default: 7 days)
 * @returns {number} Retention period in days
 */
function getVideoRetentionDays() {
  const days = parseInt(process.env.VIDEO_RETENTION_DAYS || '7', 10);
  return isNaN(days) ? 7 : days;
}

/**
 * Calculate cutoff date for video deletion
 * @param {number} retentionDays - Number of days to retain videos
 * @returns {Date} Cutoff date
 */
function getCutoffDate(retentionDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/**
 * Check if file is a video file
 * @param {string} filename - Filename to check
 * @returns {boolean} True if video file
 */
function isVideoFile(filename) {
  const videoExtensions = ['.webm', '.mp4', '.avi', '.mov', '.mkv'];
  const ext = path.extname(filename).toLowerCase();
  return videoExtensions.includes(ext);
}

/**
 * Delete videos older than retention period
 * @returns {Promise<Object>} Cleanup statistics
 */
async function cleanupVideos() {
  const startTime = Date.now();
  const retentionDays = getVideoRetentionDays();
  const cutoffDate = getCutoffDate(retentionDays);
  
  logger.info('Starting video cleanup', {
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    videosDir,
  });

  const stats = {
    totalFiles: 0,
    deletedFiles: 0,
    skippedFiles: 0,
    freedSpace: 0,
    errors: 0,
    duration: 0,
  };

  try {
    // Check if videos directory exists
    try {
      await fs.access(videosDir);
    } catch (error) {
      logger.warn('Videos directory does not exist, skipping cleanup', { videosDir });
      return stats;
    }

    // Read directory contents
    const files = await fs.readdir(videosDir);
    stats.totalFiles = files.length;

    if (files.length === 0) {
      logger.info('No files found in videos directory');
      return stats;
    }

    // Process each file
    for (const filename of files) {
      const filePath = path.join(videosDir, filename);

      try {
        // Get file stats
        const fileStat = await fs.stat(filePath);

        // Skip if not a file
        if (!fileStat.isFile()) {
          stats.skippedFiles++;
          continue;
        }

        // Skip if not a video file
        if (!isVideoFile(filename)) {
          logger.debug('Skipping non-video file', { filename });
          stats.skippedFiles++;
          continue;
        }

        // Check if file is older than cutoff date
        const fileAge = Date.now() - fileStat.mtime.getTime();
        const fileAgeDays = Math.floor(fileAge / (1000 * 60 * 60 * 24));

        if (fileStat.mtime < cutoffDate) {
          // Delete old video
          await fs.unlink(filePath);
          stats.deletedFiles++;
          stats.freedSpace += fileStat.size;

          logger.info('Deleted old video', {
            filename,
            fileAgeDays,
            size: formatBytes(fileStat.size),
            mtime: fileStat.mtime.toISOString(),
          });
        } else {
          stats.skippedFiles++;
          logger.debug('Keeping video (within retention period)', {
            filename,
            fileAgeDays,
          });
        }
      } catch (error) {
        stats.errors++;
        logger.error('Error processing video file', {
          filename,
          error: error.message,
          stack: error.stack,
        });
      }
    }

    stats.duration = Date.now() - startTime;

    // Log final summary
    logger.info('Video cleanup completed', {
      totalFiles: stats.totalFiles,
      deletedFiles: stats.deletedFiles,
      skippedFiles: stats.skippedFiles,
      freedSpace: formatBytes(stats.freedSpace),
      errors: stats.errors,
      duration: `${stats.duration}ms`,
    });

    return stats;
  } catch (error) {
    logger.error('Video cleanup failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = {
  cleanupVideos,
  getVideoRetentionDays,
};

// Allow running directly from command line
if (require.main === module) {
  require('dotenv').config();
  
  cleanupVideos()
    .then((stats) => {
      logger.info('Cleanup script finished successfully', stats);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Cleanup script failed', { error: error.message });
      process.exit(1);
    });
}
