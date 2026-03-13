const path = require('path');
const { runFfmpeg } = require('../../ffmpeg/runner');
const { buildTrimCommand } = require('../../ffmpeg/commands');
const pino = require('pino');

const logger = pino({ name: 'step-trim' });

/**
 * Parse HH:MM:SS to seconds.
 */
function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/**
 * Trim the video based on user-provided start/end times.
 *
 * @param {string} inputFile
 * @param {string} workDir
 * @param {string|null} trimStart - Trim start time (HH:MM:SS) or null
 * @param {string|null} trimEnd - Trim end time (HH:MM:SS) or null
 * @param {number} [buffer=2] - Buffer seconds to add around trim points
 * @returns {Promise<string>} Path to trimmed file
 */
async function execute(inputFile, workDir, trimStart, trimEnd, buffer = 2) {
  if (!trimStart && !trimEnd) {
    logger.info('No trim points specified — skipping');
    return inputFile;
  }

  const startSeconds = timeToSeconds(trimStart);
  const endSeconds = timeToSeconds(trimEnd);
  const outputFile = path.join(workDir, 'trimmed.mp4');

  logger.info({ trimStart, trimEnd, startSeconds, endSeconds, buffer }, 'Trimming video');

  const args = buildTrimCommand(inputFile, outputFile, startSeconds, endSeconds, buffer);
  await runFfmpeg(args);

  logger.info({ outputFile }, 'Trim complete');
  return outputFile;
}

module.exports = { execute };
