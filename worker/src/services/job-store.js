const gcs = require('./gcs');
const pino = require('pino');

const logger = pino({ name: 'worker-job-store' });

function jobPath(jobId) {
  return `jobs/${jobId}/metadata.json`;
}

async function getJob(jobId) {
  return gcs.downloadJson(jobPath(jobId));
}

async function updateJob(jobId, updates) {
  const record = await getJob(jobId);
  const updated = {
    ...record,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await gcs.uploadJson(jobPath(jobId), updated);
  logger.info({ jobId, status: updated.status, step: updates.progress?.step }, 'Job updated');
  return updated;
}

module.exports = { getJob, updateJob };
