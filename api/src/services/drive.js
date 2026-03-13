const { getDriveClient } = require('./oauth');
const config = require('../config');
const pino = require('pino');

const logger = pino({ name: 'drive' });

/**
 * List files in a Drive folder.
 * @param {string} folderId - Google Drive folder ID
 * @returns {Promise<Array>} Array of file objects { id, name, size, modifiedTime, webViewLink }
 */
async function listFiles(folderId) {
  const drive = await getDriveClient();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size, modifiedTime, webViewLink, mimeType)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });

  return res.data.files || [];
}

/**
 * Get the current intro and outro asset files.
 * Returns the most recent file in each assets folder.
 * @returns {Promise<{ intro: object|null, outro: object|null }>}
 */
async function getAssets() {
  const [introFiles, outroFiles] = await Promise.all([
    listFiles(config.drive.introFolderId),
    listFiles(config.drive.outroFolderId),
  ]);

  return {
    intro: introFiles.length > 0 ? introFiles[0] : null,
    outro: outroFiles.length > 0 ? outroFiles[0] : null,
  };
}

/**
 * Upload a file to a Drive folder.
 * @param {string} folderId - Destination folder ID
 * @param {string} fileName - File name
 * @param {Buffer|stream.Readable} body - File content
 * @param {string} mimeType - MIME type
 * @returns {Promise<object>} Created file { id, name, webViewLink }
 */
async function uploadFile(folderId, fileName, body, mimeType) {
  const drive = await getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body,
    },
    fields: 'id, name, webViewLink',
  });

  logger.info({ fileId: res.data.id, fileName, folderId }, 'Uploaded file to Drive');
  return res.data;
}

/**
 * Download a file from Drive by file ID.
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<stream.Readable>} File content stream
 */
async function downloadFile(fileId) {
  const drive = await getDriveClient();

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return res.data;
}

/**
 * Get metadata for a specific file.
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<object>} File metadata
 */
async function getFile(fileId) {
  const drive = await getDriveClient();

  const res = await drive.files.get({
    fileId,
    fields: 'id, name, size, modifiedTime, webViewLink, mimeType',
  });

  return res.data;
}

module.exports = {
  listFiles,
  getAssets,
  uploadFile,
  downloadFile,
  getFile,
};
