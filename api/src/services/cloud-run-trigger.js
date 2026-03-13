const { JobsClient } = require('@google-cloud/run').v2;
const config = require('../config');
const pino = require('pino');

const logger = pino({ name: 'cloud-run-trigger' });
const jobsClient = new JobsClient();

/**
 * Trigger the ASP processing worker Cloud Run Job.
 * Passes the JOB_ID as an environment variable override.
 *
 * @param {string} jobId - The job ID to process
 * @returns {Promise<object>} The operation result
 */
async function triggerWorkerJob(jobId) {
  const jobName = `projects/${config.gcpProjectId}/locations/${config.cloudRun.region}/jobs/${config.cloudRun.workerJobName}`;

  logger.info({ jobId, jobName }, 'Triggering worker job');

  const [operation] = await jobsClient.runJob({
    name: jobName,
    overrides: {
      containerOverrides: [{
        env: [
          { name: 'JOB_ID', value: jobId },
          { name: 'GCS_BUCKET', value: config.gcsBucket },
          { name: 'GCP_PROJECT_ID', value: config.gcpProjectId },
        ],
      }],
    },
  });

  logger.info({ jobId, operationName: operation.name }, 'Worker job triggered');
  return operation;
}

module.exports = { triggerWorkerJob };
