const gcs = require('./gcs');
const pino = require('pino');

const logger = pino({ name: 'job-store' });

const JOB_STATUS = {
  CREATED: 'created',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  PUBLISHING: 'publishing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * Get the GCS path for a job's metadata file.
 */
function jobPath(jobId) {
  return `jobs/${jobId}/metadata.json`;
}

/**
 * Create a new job record in GCS.
 * @param {object} params - Job parameters
 * @returns {Promise<object>} The created job record
 */
async function createJob({ jobId, sermonTitle, sermonDate, speaker, series, fileCount, trimStart, trimEnd }) {
  const record = {
    jobId,
    status: JOB_STATUS.CREATED,
    sermonTitle,
    sermonDate,
    speaker,
    series: series || null,
    fileCount,
    trimStart: trimStart || null,
    trimEnd: trimEnd || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: null,
    youtubeUrl: null,
    driveUrl: null,
    error: null,
  };

  await gcs.uploadJson(jobPath(jobId), record);
  logger.info({ jobId }, 'Created job record');
  return record;
}

/**
 * Get a job record from GCS.
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
async function getJob(jobId) {
  try {
    const record = await gcs.downloadJson(jobPath(jobId));
    return record;
  } catch (err) {
    if (err.code === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Update a job record with partial data.
 * @param {string} jobId
 * @param {object} updates - Fields to merge into the record
 * @returns {Promise<object>} The updated record
 */
async function updateJob(jobId, updates) {
  const record = await getJob(jobId);
  if (!record) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const updated = {
    ...record,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await gcs.uploadJson(jobPath(jobId), updated);
  logger.info({ jobId, status: updated.status }, 'Updated job record');
  return updated;
}

/**
 * Delete a job record and all associated files from GCS.
 * @param {string} jobId
 */
async function deleteJob(jobId) {
  await gcs.deletePrefix(`jobs/${jobId}/`);
  logger.info({ jobId }, 'Deleted job and associated files');
}

module.exports = {
  JOB_STATUS,
  createJob,
  getJob,
  updateJob,
  deleteJob,
};
