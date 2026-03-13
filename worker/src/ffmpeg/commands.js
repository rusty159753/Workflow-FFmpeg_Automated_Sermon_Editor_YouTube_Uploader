const fs = require('fs');
const path = require('path');

/**
 * Build FFmpeg command args for concatenating multiple input files
 * using the concat demuxer (lossless, same codec).
 *
 * @param {string[]} inputFiles - Array of file paths to concatenate
 * @param {string} outputFile - Output file path
 * @param {string} workDir - Working directory for the concat list file
 * @returns {string[]} FFmpeg args
 */
function buildConcatCommand(inputFiles, outputFile, workDir) {
  // Write concat list file
  const listPath = path.join(workDir, 'concat-list.txt');
  const listContent = inputFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listContent, 'utf8');

  return [
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    '-y', outputFile,
  ];
}

/**
 * Build ffprobe command to get media info.
 * @param {string} inputFile
 * @returns {string[]} ffprobe args (runner adds -v quiet -print_format json -show_format -show_streams)
 */
function buildProbeArgs(inputFile) {
  return [inputFile];
}

/**
 * Parse ffprobe JSON output into a useful summary.
 * @param {object} probeData - Parsed ffprobe JSON
 * @returns {object} { duration, width, height, isInterlaced, audioChannels, audioSampleRate }
 */
function parseProbeData(probeData) {
  const videoStream = probeData.streams.find(s => s.codec_type === 'video');
  const audioStream = probeData.streams.find(s => s.codec_type === 'audio');

  const duration = parseFloat(probeData.format.duration) || 0;
  const width = videoStream ? videoStream.width : 0;
  const height = videoStream ? videoStream.height : 0;

  // Detect interlacing from field_order
  const fieldOrder = videoStream ? videoStream.field_order : 'progressive';
  const isInterlaced = fieldOrder && fieldOrder !== 'progressive' && fieldOrder !== 'unknown';

  const audioChannels = audioStream ? audioStream.channels : 2;
  const audioSampleRate = audioStream ? parseInt(audioStream.sample_rate, 10) : 48000;

  return {
    duration,
    width,
    height,
    isInterlaced,
    audioChannels,
    audioSampleRate,
  };
}

/**
 * Build deinterlace command using yadif filter.
 * @param {string} inputFile
 * @param {string} outputFile
 * @returns {string[]} FFmpeg args
 */
function buildDeinterlaceCommand(inputFile, outputFile) {
  return [
    '-i', inputFile,
    '-vf', 'yadif=mode=0:parity=-1:deint=0',
    '-c:a', 'copy',
    '-y', outputFile,
  ];
}

/**
 * Build trim command.
 * @param {string} inputFile
 * @param {string} outputFile
 * @param {number} startSeconds - Trim start in seconds
 * @param {number} endSeconds - Trim end in seconds
 * @param {number} buffer - Buffer in seconds (added/subtracted from trim points)
 * @returns {string[]} FFmpeg args
 */
function buildTrimCommand(inputFile, outputFile, startSeconds, endSeconds, buffer = 2) {
  const adjustedStart = Math.max(0, startSeconds - buffer);
  const args = ['-i', inputFile];

  if (adjustedStart > 0) {
    args.push('-ss', String(adjustedStart));
  }

  if (endSeconds > 0) {
    const adjustedEnd = endSeconds + buffer;
    args.push('-to', String(adjustedEnd));
  }

  args.push('-c', 'copy', '-y', outputFile);
  return args;
}

/**
 * Build loudnorm measurement command (pass 1 of 2).
 * Output goes to null; we parse the JSON stats from stderr.
 *
 * @param {string} inputFile
 * @param {number} targetLufs
 * @param {number} truePeak
 * @returns {string[]} FFmpeg args
 */
function buildLoudnormMeasureCommand(inputFile, targetLufs = -14, truePeak = -1.0) {
  return [
    '-i', inputFile,
    '-af', `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=11:print_format=json`,
    '-f', 'null',
    '-',
  ];
}

/**
 * Parse loudnorm measurement JSON from FFmpeg stderr.
 * The JSON block appears at the end of stderr output.
 *
 * @param {string} stderr - Full stderr output from pass 1
 * @returns {object} Measured stats { input_i, input_tp, input_lra, input_thresh, target_offset }
 */
function parseLoudnormStats(stderr) {
  // Find the JSON block — it starts after the last '{' and ends at the last '}'
  const lastBrace = stderr.lastIndexOf('}');
  if (lastBrace === -1) {
    throw new Error('No loudnorm JSON found in FFmpeg output');
  }

  // Walk backwards to find the matching opening brace
  let depth = 0;
  let startIndex = -1;
  for (let i = lastBrace; i >= 0; i--) {
    if (stderr[i] === '}') depth++;
    if (stderr[i] === '{') depth--;
    if (depth === 0) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    throw new Error('Could not find matching brace in loudnorm output');
  }

  const jsonStr = stderr.substring(startIndex, lastBrace + 1);
  const stats = JSON.parse(jsonStr);

  return {
    input_i: stats.input_i,
    input_tp: stats.input_tp,
    input_lra: stats.input_lra,
    input_thresh: stats.input_thresh,
    target_offset: stats.target_offset,
  };
}

/**
 * Build loudnorm apply command (pass 2 of 2).
 * Uses measured stats from pass 1 for precise normalization.
 *
 * @param {string} inputFile
 * @param {string} outputFile
 * @param {object} stats - Measured stats from parseLoudnormStats()
 * @param {number} targetLufs
 * @param {number} truePeak
 * @returns {string[]} FFmpeg args
 */
function buildLoudnormApplyCommand(inputFile, outputFile, stats, targetLufs = -14, truePeak = -1.0) {
  const filter = [
    `loudnorm=I=${targetLufs}`,
    `TP=${truePeak}`,
    'LRA=11',
    `measured_I=${stats.input_i}`,
    `measured_TP=${stats.input_tp}`,
    `measured_LRA=${stats.input_lra}`,
    `measured_thresh=${stats.input_thresh}`,
    `offset=${stats.target_offset}`,
    'linear=true',
  ].join(':');

  return [
    '-i', inputFile,
    '-af', filter,
    '-ar', '48000',
    '-c:v', 'copy',
    '-y', outputFile,
  ];
}

/**
 * Build surround to stereo downmix command.
 * @param {string} inputFile
 * @param {string} outputFile
 * @returns {string[]} FFmpeg args
 */
function buildDownmixCommand(inputFile, outputFile) {
  return [
    '-i', inputFile,
    '-ac', '2',
    '-c:v', 'copy',
    '-y', outputFile,
  ];
}

/**
 * Build crossfade stitch command for intro + sermon + outro.
 * Uses xfade for video and acrossfade for audio.
 *
 * @param {string} introFile
 * @param {string} sermonFile
 * @param {string} outroFile
 * @param {string} outputFile
 * @param {number} introDuration - Duration of intro in seconds
 * @param {number} sermonDuration - Duration of sermon in seconds
 * @param {number} crossfadeDuration - Crossfade duration in seconds (default 1)
 * @returns {string[]} FFmpeg args
 */
function buildStitchCommand(introFile, sermonFile, outroFile, outputFile, introDuration, sermonDuration, crossfadeDuration = 1) {
  const xd = crossfadeDuration;

  // xfade offsets
  const offset1 = introDuration - xd;
  const offset2 = (introDuration - xd) + (sermonDuration - xd);

  const filterComplex = [
    // Video crossfades
    `[0:v][1:v]xfade=transition=fade:duration=${xd}:offset=${offset1.toFixed(3)}[v01]`,
    `[v01][2:v]xfade=transition=fade:duration=${xd}:offset=${offset2.toFixed(3)}[vout]`,
    // Audio crossfades
    `[0:a][1:a]acrossfade=d=${xd}:c1=tri:c2=tri[a01]`,
    `[a01][2:a]acrossfade=d=${xd}:c1=tri:c2=tri[aout]`,
  ].join(';');

  return [
    '-i', introFile,
    '-i', sermonFile,
    '-i', outroFile,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '[aout]',
    '-y', outputFile,
  ];
}

/**
 * Build final encode command.
 * H.264 CRF 18, AAC 192k, 1080p with padding, faststart.
 *
 * @param {string} inputFile
 * @param {string} outputFile
 * @param {object} options
 * @param {number} [options.crf=18]
 * @param {string} [options.audioBitrate='192k']
 * @param {string} [options.resolution='1920:1080']
 * @returns {string[]} FFmpeg args
 */
function buildFinalEncodeCommand(inputFile, outputFile, options = {}) {
  const crf = options.crf || 18;
  const audioBitrate = options.audioBitrate || '192k';
  const resolution = options.resolution || '1920:1080';

  const [width, height] = resolution.split(':');
  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;

  return [
    '-i', inputFile,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', String(crf),
    '-vf', scaleFilter,
    '-c:a', 'aac',
    '-b:a', audioBitrate,
    '-ar', '48000',
    '-movflags', '+faststart',
    '-y', outputFile,
  ];
}

module.exports = {
  buildConcatCommand,
  buildProbeArgs,
  parseProbeData,
  buildDeinterlaceCommand,
  buildTrimCommand,
  buildLoudnormMeasureCommand,
  parseLoudnormStats,
  buildLoudnormApplyCommand,
  buildDownmixCommand,
  buildStitchCommand,
  buildFinalEncodeCommand,
};
