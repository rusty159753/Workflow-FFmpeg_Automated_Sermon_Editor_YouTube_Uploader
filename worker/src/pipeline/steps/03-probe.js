const { runFfprobe } = require('../../ffmpeg/runner');
const { buildProbeArgs, parseProbeData } = require('../../ffmpeg/commands');
const pino = require('pino');

const logger = pino({ name: 'step-probe' });

/**
 * Probe a media file to detect its properties.
 *
 * @param {string} inputFile - Path to the file to probe
 * @returns {Promise<object>} { duration, width, height, isInterlaced, audioChannels, audioSampleRate }
 */
async function execute(inputFile) {
  logger.info({ inputFile }, 'Probing media file');

  const probeArgs = buildProbeArgs(inputFile);
  const rawData = await runFfprobe(probeArgs);
  const probeData = parseProbeData(rawData);

  logger.info({
    duration: `${probeData.duration.toFixed(1)}s`,
    resolution: `${probeData.width}x${probeData.height}`,
    interlaced: probeData.isInterlaced,
    audioChannels: probeData.audioChannels,
  }, 'Probe complete');

  return probeData;
}

module.exports = { execute };
