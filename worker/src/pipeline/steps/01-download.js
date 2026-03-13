const path = require('path');
const gcs = require('../../services/gcs');
const pino = require('pino');

const logger = pino({ name: 'step-download' });

/**
 * Download all uploaded file parts from GCS to the local work directory.
 *
 * @param {string} jobId
 * @param {number} fileCount
 * @param {string} workDir
 * @returns {Promise<string[]>} Array of local file paths
 */
async function execute(jobId, fileCount, workDir) {
  const localFiles = [];

  for (let i = 0; i < fileCount; i++) {
    const gcsPath = `jobs/${jobId}/part-${i}.mp4`;
    const localPath = path.join(workDir, `part-${i}.mp4`);

    logger.info({ gcsPath, localPath }, `Downloading part ${i + 1}/${fileCount}`);
    await gcs.downloadFile(gcsPath, localPath);
    localFiles.push(localPath);
  }

  logger.info({ count: localFiles.length }, 'All parts downloaded');
  return localFiles;
}

module.exports = { execute };
