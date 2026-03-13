const { Storage } = require('@google-cloud/storage');
const config = require('../config');
const pino = require('pino');

const logger = pino({ name: 'gcs' });
const storage = new Storage({ projectId: config.gcpProjectId });
const bucket = storage.bucket(config.gcsBucket);

/**
 * Generate a V4 signed URL for direct browser upload to GCS.
 * @param {string} filePath - The GCS object path (e.g., "staging/jobId/part-0.mp4")
 * @param {string} contentType - The MIME type (e.g., "video/mp4")
 * @param {number} [expiresInSeconds=3600] - URL expiry in seconds
 * @returns {Promise<string>} The signed upload URL
 */
async function generateSignedUploadUrl(filePath, contentType, expiresInSeconds = 3600) {
  const file = bucket.file(filePath);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresInSeconds * 1000,
    contentType,
  });

  logger.info({ filePath, contentType }, 'Generated signed upload URL');
  return url;
}

/**
 * Generate a V4 signed URL for reading a file from GCS.
 * @param {string} filePath - The GCS object path
 * @param {number} [expiresInSeconds=3600] - URL expiry in seconds
 * @returns {Promise<string>} The signed read URL
 */
async function generateSignedReadUrl(filePath, expiresInSeconds = 3600) {
  const file = bucket.file(filePath);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInSeconds * 1000,
  });

  return url;
}

/**
 * Upload a JSON object to GCS.
 * @param {string} filePath - The GCS object path
 * @param {object} data - The JSON data to store
 */
async function uploadJson(filePath, data) {
  const file = bucket.file(filePath);
  const content = JSON.stringify(data, null, 2);

  await file.save(content, {
    contentType: 'application/json',
    resumable: false,
  });

  logger.debug({ filePath }, 'Uploaded JSON to GCS');
}

/**
 * Download and parse a JSON object from GCS.
 * @param {string} filePath - The GCS object path
 * @returns {Promise<object>} The parsed JSON data
 */
async function downloadJson(filePath) {
  const file = bucket.file(filePath);

  const [content] = await file.download();
  return JSON.parse(content.toString('utf8'));
}

/**
 * Check if a file exists in GCS.
 * @param {string} filePath - The GCS object path
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Delete all objects under a given prefix.
 * @param {string} prefix - The GCS prefix to delete (e.g., "staging/jobId/")
 */
async function deletePrefix(prefix) {
  await bucket.deleteFiles({ prefix, force: true });
  logger.info({ prefix }, 'Deleted GCS prefix');
}

/**
 * Download a file from GCS to a local path.
 * @param {string} gcsPath - The GCS object path
 * @param {string} localPath - Local file path to save to
 */
async function downloadFile(gcsPath, localPath) {
  const file = bucket.file(gcsPath);
  await file.download({ destination: localPath });
  logger.debug({ gcsPath, localPath }, 'Downloaded file from GCS');
}

/**
 * Upload a local file to GCS.
 * @param {string} localPath - Local file path
 * @param {string} gcsPath - The GCS destination path
 * @param {string} [contentType] - Optional MIME type
 */
async function uploadFile(localPath, gcsPath, contentType) {
  const options = { destination: gcsPath };
  if (contentType) {
    options.metadata = { contentType };
  }
  await bucket.upload(localPath, options);
  logger.debug({ localPath, gcsPath }, 'Uploaded file to GCS');
}

module.exports = {
  generateSignedUploadUrl,
  generateSignedReadUrl,
  uploadJson,
  downloadJson,
  fileExists,
  deletePrefix,
  downloadFile,
  uploadFile,
  bucket,
};
