const fs = require('fs');
const { getDriveClient } = require('./oauth');
const pino = require('pino');

const logger = pino({ name: 'worker-drive' });

/**
 * Download a file from Drive to a local path.
 * @param {string} fileId - Google Drive file ID
 * @param {string} localPath - Local file path to save to
 */
async function downloadFile(fileId, localPath) {
  const drive = await getDriveClient();

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(localPath);
    res.data
      .on('error', reject)
      .pipe(dest)
      .on('finish', () => {
        logger.info({ fileId, localPath }, 'Downloaded from Drive');
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * Get the most recent file in a Drive folder.
 * @param {string} folderId - Drive folder ID
 * @returns {Promise<object|null>} File metadata or null
 */
async function getLatestFile(folderId) {
  const drive = await getDriveClient();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'modifiedTime desc',
    pageSize: 1,
  });

  const files = res.data.files || [];
  return files.length > 0 ? files[0] : null;
}

/**
 * Upload a file to a Drive folder.
 * @param {string} localPath - Local file path
 * @param {string} fileName - Name for the Drive file
 * @param {string} folderId - Destination folder ID
 * @param {boolean} [dryRun=false] - If true, skip actual upload
 * @returns {Promise<string>} Drive file web view URL
 */
async function uploadFile(localPath, fileName, folderId, dryRun = false) {
  if (dryRun) {
    logger.info({ fileName, folderId }, 'DRY RUN: Would upload to Drive');
    return 'https://drive.google.com/file/d/DRY_RUN_PLACEHOLDER/view';
  }

  const drive = await getDriveClient();
  const fileSize = fs.statSync(localPath).size;

  logger.info({
    fileName,
    fileSize: `${(fileSize / (1024 * 1024)).toFixed(1)} MB`,
    folderId,
  }, 'Uploading to Drive');

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      body: fs.createReadStream(localPath),
    },
    fields: 'id, webViewLink',
  });

  logger.info({ fileId: res.data.id, fileName }, 'Drive upload complete');
  return res.data.webViewLink;
}

module.exports = { downloadFile, getLatestFile, uploadFile };
