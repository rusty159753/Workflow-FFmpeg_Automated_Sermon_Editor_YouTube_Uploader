const pino = require('pino');
const { runPipeline } = require('./src/pipeline/orchestrator');

const logger = pino({ name: 'asp-worker' });

async function main() {
  const jobId = process.env.JOB_ID;

  if (!jobId) {
    logger.error('JOB_ID environment variable is not set');
    process.exit(1);
  }

  if (!process.env.GCS_BUCKET) {
    logger.error('GCS_BUCKET environment variable is not set');
    process.exit(1);
  }

  logger.info({ jobId }, 'ASP Worker starting');

  try {
    await runPipeline(jobId);
    logger.info({ jobId }, 'ASP Worker finished successfully');
    process.exit(0);
  } catch (err) {
    logger.error({ jobId, err }, 'ASP Worker failed');
    process.exit(1);
  }
}

main();
