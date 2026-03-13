const path = require('path');
const { runFfmpeg } = require('../../ffmpeg/runner');
const { buildDeinterlaceCommand } = require('../../ffmpeg/commands');
const pino = require('pino');

const logger = pino({ name: 'step-deinterlace' });

/**
 * Deinterlace video using yadif filter.
 *
 * @param {string} inputFile
 * @param {string} workDir
 * @returns {Promise<string>} Path to deinterlaced file
 */
async function execute(inputFile, workDir) {
  const outputFile = path.join(workDir, 'deinterlaced.mp4');
  const args = buildDeinterlaceCommand(inputFile, outputFile);

  logger.info('Deinterlacing video');
  await runFfmpeg(args);

  logger.info({ outputFile }, 'Deinterlace complete');
  return outputFile;
}

module.exports = { execute };
