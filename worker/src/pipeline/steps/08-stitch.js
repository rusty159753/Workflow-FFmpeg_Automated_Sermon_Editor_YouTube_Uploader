const path = require('path');
const { runFfmpeg, runFfprobe } = require('../../ffmpeg/runner');
const { buildStitchCommand, buildProbeArgs, parseProbeData } = require('../../ffmpeg/commands');
const driveService = require('../../services/drive');
const pino = require('pino');

const logger = pino({ name: 'step-stitch' });

/**
 * Download intro/outro from Drive and stitch with crossfades.
 *
 * @param {string} sermonFile - Path to the sermon video
 * @param {string} workDir
 * @param {string} introFolderId - Drive folder ID for intro assets
 * @param {string} outroFolderId - Drive folder ID for outro assets
 * @param {number} [crossfadeDuration=1] - Crossfade duration in seconds
 * @returns {Promise<string>} Path to stitched file
 */
async function execute(sermonFile, workDir, introFolderId, outroFolderId, crossfadeDuration = 1) {
  // Download intro and outro from Drive
  logger.info('Downloading intro asset from Drive');
  const introMeta = await driveService.getLatestFile(introFolderId);
  if (!introMeta) throw new Error('No intro file found in Drive Assets/Intro folder');

  const introFile = path.join(workDir, 'intro.mp4');
  await driveService.downloadFile(introMeta.id, introFile);

  logger.info('Downloading outro asset from Drive');
  const outroMeta = await driveService.getLatestFile(outroFolderId);
  if (!outroMeta) throw new Error('No outro file found in Drive Assets/Outro folder');

  const outroFile = path.join(workDir, 'outro.mp4');
  await driveService.downloadFile(outroMeta.id, outroFile);

  // Probe durations for xfade offset calculation
  logger.info('Probing durations for crossfade offsets');

  const introProbe = parseProbeData(await runFfprobe(buildProbeArgs(introFile)));
  const sermonProbe = parseProbeData(await runFfprobe(buildProbeArgs(sermonFile)));

  logger.info({
    introDuration: introProbe.duration.toFixed(2),
    sermonDuration: sermonProbe.duration.toFixed(2),
    crossfadeDuration,
  }, 'Durations probed');

  // Build and run the stitch command
  const outputFile = path.join(workDir, 'stitched.mp4');
  const args = buildStitchCommand(
    introFile,
    sermonFile,
    outroFile,
    outputFile,
    introProbe.duration,
    sermonProbe.duration,
    crossfadeDuration
  );

  logger.info('Stitching intro + sermon + outro with crossfades');
  await runFfmpeg(args);

  logger.info({ outputFile }, 'Stitch complete');
  return outputFile;
}

module.exports = { execute };
