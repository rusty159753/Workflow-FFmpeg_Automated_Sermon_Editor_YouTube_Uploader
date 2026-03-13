const path = require('path');
const { runFfmpeg } = require('../../ffmpeg/runner');
const { buildConcatCommand } = require('../../ffmpeg/commands');
const pino = require('pino');

const logger = pino({ name: 'step-concat' });

/**
 * Concatenate multiple file parts into a single file.
 * Uses the concat demuxer for lossless concatenation.
 *
 * @param {string[]} inputFiles - Array of local file paths
 * @param {string} workDir
 * @returns {Promise<string>} Path to concatenated file
 */
async function execute(inputFiles, workDir) {
  if (inputFiles.length === 1) {
    logger.info('Single file — skipping concat');
    return inputFiles[0];
  }

  const outputFile = path.join(workDir, 'concatenated.mp4');
  const args = buildConcatCommand(inputFiles, outputFile, workDir);

  logger.info({ inputCount: inputFiles.length }, 'Concatenating files');
  await runFfmpeg(args);

  logger.info({ outputFile }, 'Concatenation complete');
  return outputFile;
}

module.exports = { execute };
