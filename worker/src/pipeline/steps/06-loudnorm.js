const path = require('path');
const { runFfmpeg } = require('../../ffmpeg/runner');
const { buildLoudnormMeasureCommand, parseLoudnormStats, buildLoudnormApplyCommand } = require('../../ffmpeg/commands');
const pino = require('pino');

const logger = pino({ name: 'step-loudnorm' });

/**
 * Two-pass loudness normalization to EBU R128 standard.
 *
 * Pass 1: Measure the input's loudness stats.
 * Pass 2: Apply normalization using measured stats for precise results.
 *
 * @param {string} inputFile
 * @param {string} workDir
 * @param {number} [targetLufs=-14]
 * @param {number} [truePeak=-1.0]
 * @returns {Promise<string>} Path to normalized file
 */
async function execute(inputFile, workDir, targetLufs = -14, truePeak = -1.0) {
  // Pass 1: Measure
  logger.info({ targetLufs, truePeak }, 'Loudnorm pass 1: measuring');
  const measureArgs = buildLoudnormMeasureCommand(inputFile, targetLufs, truePeak);
  const { stderr } = await runFfmpeg(measureArgs);

  const stats = parseLoudnormStats(stderr);
  logger.info({
    measured_I: stats.input_i,
    measured_TP: stats.input_tp,
    measured_LRA: stats.input_lra,
  }, 'Loudnorm pass 1 complete — measured stats');

  // Pass 2: Apply
  const outputFile = path.join(workDir, 'normalized.mp4');
  logger.info('Loudnorm pass 2: applying normalization');
  const applyArgs = buildLoudnormApplyCommand(inputFile, outputFile, stats, targetLufs, truePeak);
  await runFfmpeg(applyArgs);

  logger.info({ outputFile }, 'Loudnorm complete');
  return outputFile;
}

module.exports = { execute };
