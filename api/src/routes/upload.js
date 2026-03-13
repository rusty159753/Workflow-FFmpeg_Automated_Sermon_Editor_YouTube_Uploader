const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validateUploadRequest } = require('../middleware/validate');
const gcs = require('../services/gcs');
const jobStore = require('../services/job-store');
const pino = require('pino');

const router = express.Router();
const logger = pino({ name: 'route-upload' });

/**
 * POST /api/upload-url
 *
 * Creates a new job and returns signed GCS upload URLs for the browser
 * to upload video file(s) directly.
 *
 * Request body:
 *   - sermonTitle (string, required)
 *   - sermonDate (string, required, YYYY-MM-DD)
 *   - speaker (string, required)
 *   - series (string, optional)
 *   - fileCount (number, required, 1-10)
 *   - trimStart (string, optional, HH:MM:SS)
 *   - trimEnd (string, optional, HH:MM:SS)
 *
 * Response:
 *   - jobId (string)
 *   - uploadUrls (array of { index, url, path })
 *   - expiresAt (string, ISO timestamp)
 */
router.post('/upload-url', async (req, res, next) => {
  try {
    // Validate input
    const validationError = validateUploadRequest(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { sermonTitle, sermonDate, speaker, series, fileCount, trimStart, trimEnd } = req.body;
    const jobId = uuidv4();

    logger.info({ jobId, sermonTitle, speaker, fileCount }, 'Creating new upload job');

    // Create job record
    const job = await jobStore.createJob({
      jobId,
      sermonTitle: sermonTitle.trim(),
      sermonDate,
      speaker: speaker.trim(),
      series: series ? series.trim() : null,
      fileCount,
      trimStart: trimStart || null,
      trimEnd: trimEnd || null,
    });

    // Generate signed URLs for each file part
    const expiresInSeconds = 3600; // 1 hour
    const uploadUrls = [];

    for (let i = 0; i < fileCount; i++) {
      const filePath = `jobs/${jobId}/part-${i}.mp4`;
      const url = await gcs.generateSignedUploadUrl(filePath, 'video/mp4', expiresInSeconds);
      uploadUrls.push({ index: i, url, path: filePath });
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    logger.info({ jobId, urlCount: uploadUrls.length }, 'Generated signed upload URLs');

    res.status(201).json({
      jobId,
      uploadUrls,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
