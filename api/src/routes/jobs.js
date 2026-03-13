const express = require('express');
const jobStore = require('../services/job-store');
const { triggerWorkerJob } = require('../services/cloud-run-trigger');
const pino = require('pino');

const router = express.Router();
const logger = pino({ name: 'route-jobs' });

/**
 * POST /api/jobs/:jobId/start
 *
 * Signals that all file uploads are complete and triggers processing.
 * Updates job status to 'uploaded' and launches the Cloud Run worker job.
 */
router.post('/jobs/:jobId/start', async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await jobStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only allow starting from 'created' or 'uploading' status
    if (job.status !== jobStore.JOB_STATUS.CREATED && job.status !== jobStore.JOB_STATUS.UPLOADING) {
      return res.status(409).json({
        error: `Job cannot be started from status '${job.status}'`,
      });
    }

    logger.info({ jobId }, 'Starting job processing');

    // Update status
    await jobStore.updateJob(jobId, { status: jobStore.JOB_STATUS.UPLOADED });

    // Trigger the worker
    await triggerWorkerJob(jobId);

    // Update status to processing
    await jobStore.updateJob(jobId, { status: jobStore.JOB_STATUS.PROCESSING });

    res.json({ jobId, status: jobStore.JOB_STATUS.PROCESSING });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jobs/:jobId/status
 *
 * Returns the current status and metadata for a job.
 */
router.get('/jobs/:jobId/status', async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await jobStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.jobId,
      status: job.status,
      sermonTitle: job.sermonTitle,
      sermonDate: job.sermonDate,
      speaker: job.speaker,
      progress: job.progress,
      youtubeUrl: job.youtubeUrl,
      driveUrl: job.driveUrl,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
