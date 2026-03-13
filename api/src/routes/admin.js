const express = require('express');
const multer = require('multer');
const adminAuth = require('../middleware/auth');
const driveService = require('../services/drive');
const gcs = require('../services/gcs');
const config = require('../config');
const pino = require('pino');

const router = express.Router();
const logger = pino({ name: 'route-admin' });

// Multer for handling file uploads (in memory, max 500MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// All admin routes require authentication
router.use(adminAuth);

/**
 * POST /api/admin/upload-asset
 *
 * Upload an intro or outro video to the corresponding Drive assets folder.
 *
 * Form data:
 *   - type: "intro" or "outro" (required)
 *   - file: video file (required)
 */
router.post('/upload-asset', upload.single('file'), async (req, res, next) => {
  try {
    const { type } = req.body;

    if (!type || !['intro', 'outro'].includes(type)) {
      return res.status(400).json({ error: 'type must be "intro" or "outro"' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folderId = type === 'intro'
      ? config.drive.introFolderId
      : config.drive.outroFolderId;

    if (!folderId) {
      return res.status(500).json({ error: `Drive ${type} folder ID not configured` });
    }

    logger.info({ type, fileName: req.file.originalname, size: req.file.size }, 'Uploading asset to Drive');

    const { Readable } = require('stream');
    const stream = Readable.from(req.file.buffer);

    const result = await driveService.uploadFile(
      folderId,
      req.file.originalname,
      stream,
      req.file.mimetype
    );

    res.json({
      message: `${type} asset uploaded successfully`,
      file: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/assets
 *
 * Returns info about the current intro and outro asset files.
 */
router.get('/assets', async (req, res, next) => {
  try {
    const assets = await driveService.getAssets();
    res.json(assets);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/dry-run
 *
 * Toggle dry-run mode on or off.
 *
 * Body:
 *   - enabled: boolean (required)
 */
router.post('/dry-run', async (req, res, next) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    await gcs.uploadJson('config/dry-run.json', { enabled, updatedAt: new Date().toISOString() });
    logger.info({ enabled }, 'Dry-run mode updated');

    res.json({ dryRun: enabled });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/config
 *
 * Returns non-sensitive configuration for display in the admin UI.
 */
router.get('/config', async (req, res, next) => {
  try {
    // Check dry-run status from GCS
    let dryRun = config.features.dryRun;
    try {
      const dryRunConfig = await gcs.downloadJson('config/dry-run.json');
      dryRun = dryRunConfig.enabled;
    } catch (err) {
      // File may not exist yet — use default
    }

    res.json({
      gcsBucket: config.gcsBucket,
      gcsRegion: config.gcsRegion,
      processing: config.processing,
      youtube: {
        defaultPrivacy: config.youtube.defaultPrivacy,
        defaultCategoryId: config.youtube.defaultCategoryId,
      },
      upload: config.upload,
      dryRun,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
