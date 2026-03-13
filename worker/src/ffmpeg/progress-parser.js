/**
 * Parse FFmpeg stderr output for progress information.
 *
 * FFmpeg outputs lines like:
 *   frame=  120 fps=30 q=28.0 size=    1024kB time=00:00:04.00 bitrate=2096.0kbits/s speed=1.5x
 *
 * We extract the time= field and compute a percentage relative to the total duration.
 */

/**
 * Extract the current time in seconds from an FFmpeg stderr line.
 * @param {string} line - A line from FFmpeg stderr
 * @returns {number|null} Current time in seconds, or null if not found
 */
function parseTimestamp(line) {
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centiseconds = parseInt(match[4], 10);

  return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
}

/**
 * Create a progress callback that computes percentage from FFmpeg stderr.
 *
 * @param {number} totalDuration - Total expected duration in seconds
 * @param {function} onProgress - Callback receiving (percent: number)
 * @returns {function} A function to pass as onStderr to runFfmpeg
 */
function createProgressHandler(totalDuration, onProgress) {
  let lastReported = -1;

  return function handleStderr(line) {
    const currentTime = parseTimestamp(line);
    if (currentTime === null) return;

    const percent = Math.min(
      Math.round((currentTime / totalDuration) * 100),
      100
    );

    // Only report when percent changes
    if (percent !== lastReported) {
      lastReported = percent;
      onProgress(percent);
    }
  };
}

module.exports = { parseTimestamp, createProgressHandler };
