const path = require('path');
const { runFfmpeg } = require('../../ffmpeg/runner');
const { buildDownmixCommand } = require('../../ffmpeg/commands');
const pino = require('pino');

const logger = pino({ name: 'step-downmix' });

/**
 * Downmix surround audio to stereo.
 *
 * @param {string} inputFile
 * @param {string} workDir
 * @returns {Promise<string>} Path to downmixed file
 */
async function execute(inputFile, workDir) {
  const outputFile = path.join(workDir, 'downmixed.mp4');
  const args = buildDownmixCommand(inputFile, outputFile);

  logger.info('Downmixing surround audio to stereo');
  await runFfmpeg(args);

  logger.info({ outputFile }, 'Downmix complete');
  return outputFile;
}

module.exports = { execute };
