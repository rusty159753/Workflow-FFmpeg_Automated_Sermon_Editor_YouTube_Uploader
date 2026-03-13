/**
 * Validation helpers for request bodies.
 * Returns error messages or null if valid.
 */

/**
 * Validate the upload request body.
 * @param {object} body - Request body
 * @returns {string|null} Error message or null
 */
function validateUploadRequest(body) {
  const { sermonTitle, sermonDate, speaker, fileCount, trimStart, trimEnd } = body;

  if (!sermonTitle || typeof sermonTitle !== 'string' || sermonTitle.trim().length === 0) {
    return 'sermonTitle is required and must be a non-empty string';
  }

  if (!sermonDate || !/^\d{4}-\d{2}-\d{2}$/.test(sermonDate)) {
    return 'sermonDate is required in YYYY-MM-DD format';
  }

  // Validate the date is real
  const date = new Date(sermonDate + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    return 'sermonDate is not a valid date';
  }

  if (!speaker || typeof speaker !== 'string' || speaker.trim().length === 0) {
    return 'speaker is required and must be a non-empty string';
  }

  if (!fileCount || typeof fileCount !== 'number' || fileCount < 1 || fileCount > 10) {
    return 'fileCount is required and must be a number between 1 and 10';
  }

  // Validate optional trim times
  const timePattern = /^(\d{1,2}):(\d{2}):(\d{2})$/;

  if (trimStart !== undefined && trimStart !== null && trimStart !== '') {
    if (!timePattern.test(trimStart)) {
      return 'trimStart must be in HH:MM:SS format';
    }
  }

  if (trimEnd !== undefined && trimEnd !== null && trimEnd !== '') {
    if (!timePattern.test(trimEnd)) {
      return 'trimEnd must be in HH:MM:SS format';
    }
  }

  return null;
}

/**
 * Parse a time string (HH:MM:SS) to total seconds.
 * @param {string} timeStr
 * @returns {number} Total seconds
 */
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/**
 * Format seconds to HH:MM:SS string.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatSecondsToTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

module.exports = {
  validateUploadRequest,
  parseTimeToSeconds,
  formatSecondsToTime,
};
