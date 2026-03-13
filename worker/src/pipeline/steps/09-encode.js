const path = require('path');
const { runFfmpeg } = require('../../ffmpeg/runner');
const { buildFinalEncodeCommand } = require('../../ffmpeg/commands');
const { createProgressHandler } = require('../../ffmpeg/progress-parser');
const pino = require('pino');

const logger = pino({ name: 'step-encode' });

/**
 * Final encode: H.264 CRF 18, AAC 192k, 1080p, faststart.
 *
 * @param {string} inputFile
 * @param {string} workDir
 * @param {number} estimatedDuration - Duration in seconds for progress tracking
 * @param {function} [onProgress] - Progress callback (percent)
 * @param {object} [options] - Encode options { crf, audioBitrate, resolution }
 * @returns {Promise<string>} Path to final encoded file
 */
async function execute(inputFile, workDir, estimatedDuration, onProgress, options = {}) {
  const outputFile = path.join(workDir, 'final.mp4');
  const args = buildFinalEncodeCommand(inputFile, outputFile, options);

  logger.info({
    crf: options.crf || 18,
    audioBitrate: options.audioBitrate || '192k',
  }, 'Starting final encode');

  const stderrHandler = estimatedDuration && onProgress
    ? createProgressHandler(estimatedDuration, onProgress)
    : undefined;

  await runFfmpeg(args, { onStderr: stderrHandler });

  logger.info({ outputFile }, 'Final encode complete');
  return outputFile;
}

module.exports = { execute };
