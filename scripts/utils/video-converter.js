const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs').promises;
const { logger } = require('./logger');

// Set the path to the local binary
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Converts a WebM file to MP4
 * @param {string} inputPath - Path to source .webm file
 * @param {string} outputPath - Path to destination .mp4 file
 * @returns {Promise<string>} - Resolves with outputPath on success
 */
function convertWebMtoMP4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    logger.info('Starting video conversion', { input: inputPath, output: outputPath });
    
    ffmpeg(inputPath)
      .outputOptions('-c:v libx264') // Use H.264 codec for better compatibility
      .outputOptions('-preset fast') // Faster encoding
      .outputOptions('-crf 23') // Balanced quality/size
      .save(outputPath)
      .on('end', () => {
        logger.info('Video conversion finished successfully');
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Error during video conversion', { error: err.message });
        reject(err);
      });
  });
}

module.exports = {
  convertWebMtoMP4
};
