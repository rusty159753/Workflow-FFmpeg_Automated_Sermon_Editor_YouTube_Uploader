const fs = require('fs');
const jobStore = require('../services/job-store');
const gcsService = require('../services/gcs');
const pino = require('pino');

// Pipeline steps
const downloadStep = require('./steps/01-download');
const concatStep = require('./steps/02-concat');
const probeStep = require('./steps/03-probe');
const deinterlaceStep = require('./steps/04-deinterlace');
const trimStep = require('./steps/05-trim');
const loudnormStep = require('./steps/06-loudnorm');
const downmixStep = require('./steps/07-downmix');
const stitchStep = require('./steps/08-stitch');
const encodeStep = require('./steps/09-encode');
const uploadStep = require('./steps/10-upload');

const logger = pino({ name: 'orchestrator' });

/**
 * Update job status and progress in GCS.
 */
async function updateStatus(jobId, status, extra = {}) {
  const updates = { status };
  if (extra.step) {
    updates.progress = { step: extra.step, percent: extra.percent || 0 };
  }
  if (extra.youtubeUrl) updates.youtubeUrl = extra.youtubeUrl;
  if (extra.driveUrl) updates.driveUrl = extra.driveUrl;
  if (extra.error) updates.error = extra.error;

  await jobStore.updateJob(jobId, updates);
}

/**
 * Load config from GCS (the worker reads the same config as the API).
 */
async function loadConfig() {
  // Load processing config from the worker's config.yaml copy
  const yaml = require('js-yaml');
  const configPath = require('path').join(__dirname, '..', '..', 'config.yaml');

  if (fs.existsSync(configPath)) {
    const raw = yaml.load(fs.readFileSync(configPath, 'utf8'));
    return {
      processing: {
        crossfadeDuration: raw.processing?.crossfade_duration || 1,
        targetLufs: raw.processing?.target_lufs || -14,
        truePeakDbtp: raw.processing?.true_peak_dbtp || -1.0,
        videoCrf: raw.processing?.video_crf || 18,
        audioBitrate: raw.processing?.audio_bitrate || '192k',
        outputResolution: raw.processing?.output_resolution || '1920:1080',
        trimBuffer: raw.processing?.trim_buffer || 2,
      },
      drive: {
        introFolderId: process.env.DRIVE_INTRO_FOLDER_ID || raw.drive?.intro_folder_id || '',
        outroFolderId: process.env.DRIVE_OUTRO_FOLDER_ID || raw.drive?.outro_folder_id || '',
        outputFolderId: process.env.DRIVE_OUTPUT_FOLDER_ID || raw.drive?.output_folder_id || '',
        logsFolderId: process.env.DRIVE_LOGS_FOLDER_ID || raw.drive?.logs_folder_id || '',
      },
      youtube: {
        defaultPrivacy: raw.youtube?.default_privacy || 'unlisted',
        defaultCategoryId: raw.youtube?.default_category_id || '29',
        descriptionFooter: raw.youtube?.description_footer || '',
      },
    };
  }

  // Fallback: return defaults
  return {
    processing: {
      crossfadeDuration: 1, targetLufs: -14, truePeakDbtp: -1.0,
      videoCrf: 18, audioBitrate: '192k', outputResolution: '1920:1080', trimBuffer: 2,
    },
    drive: {
      introFolderId: process.env.DRIVE_INTRO_FOLDER_ID || '',
      outroFolderId: process.env.DRIVE_OUTRO_FOLDER_ID || '',
      outputFolderId: process.env.DRIVE_OUTPUT_FOLDER_ID || '',
      logsFolderId: process.env.DRIVE_LOGS_FOLDER_ID || '',
    },
    youtube: {
      defaultPrivacy: 'unlisted', defaultCategoryId: '29', descriptionFooter: '',
    },
  };
}

/**
 * Check if dry-run mode is enabled (stored in GCS).
 */
async function isDryRun() {
  try {
    const dryRunConfig = await gcsService.downloadJson('config/dry-run.json');
    return dryRunConfig.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Run the complete processing pipeline for a job.
 *
 * @param {string} jobId - The job ID to process
 */
async function runPipeline(jobId) {
  const workDir = `/tmp/${jobId}`;
  fs.mkdirSync(workDir, { recursive: true });

  const startTime = Date.now();
  let jobRecord;

  try {
    // Load job record and config
    jobRecord = await jobStore.getJob(jobId);
    const config = await loadConfig();
    const dryRun = await isDryRun();

    logger.info({
      jobId,
      title: jobRecord.sermonTitle,
      fileCount: jobRecord.fileCount,
      dryRun,
    }, 'Starting pipeline');

    // Step 1: Download files from GCS
    await updateStatus(jobId, 'processing', { step: 'download', percent: 0 });
    const partFiles = await downloadStep.execute(jobId, jobRecord.fileCount, workDir);

    // Step 2: Concatenate if multiple parts
    await updateStatus(jobId, 'processing', { step: 'concat', percent: 0 });
    let sermonFile = await concatStep.execute(partFiles, workDir);

    // Step 3: Probe media properties
    await updateStatus(jobId, 'processing', { step: 'probe', percent: 0 });
    const probeData = await probeStep.execute(sermonFile);

    // Step 4: Deinterlace if needed
    if (probeData.isInterlaced) {
      await updateStatus(jobId, 'processing', { step: 'deinterlace', percent: 0 });
      sermonFile = await deinterlaceStep.execute(sermonFile, workDir);
    }

    // Step 5: Trim
    if (jobRecord.trimStart || jobRecord.trimEnd) {
      await updateStatus(jobId, 'processing', { step: 'trim', percent: 0 });
      sermonFile = await trimStep.execute(
        sermonFile, workDir,
        jobRecord.trimStart, jobRecord.trimEnd,
        config.processing.trimBuffer
      );
    }

    // Step 6: Loudness normalization (two-pass)
    await updateStatus(jobId, 'processing', { step: 'loudnorm', percent: 0 });
    sermonFile = await loudnormStep.execute(
      sermonFile, workDir,
      config.processing.targetLufs,
      config.processing.truePeakDbtp
    );

    // Step 7: Downmix if surround
    if (probeData.audioChannels > 2) {
      await updateStatus(jobId, 'processing', { step: 'downmix', percent: 0 });
      sermonFile = await downmixStep.execute(sermonFile, workDir);
    }

    // Step 8: Stitch intro + sermon + outro
    await updateStatus(jobId, 'processing', { step: 'stitch', percent: 0 });
    sermonFile = await stitchStep.execute(
      sermonFile, workDir,
      config.drive.introFolderId,
      config.drive.outroFolderId,
      config.processing.crossfadeDuration
    );

    // Step 9: Final encode
    await updateStatus(jobId, 'processing', { step: 'encode', percent: 0 });
    const finalFile = await encodeStep.execute(
      sermonFile, workDir,
      probeData.duration,
      (percent) => {
        // Fire-and-forget progress update
        updateStatus(jobId, 'processing', { step: 'encode', percent }).catch(() => {});
      },
      {
        crf: config.processing.videoCrf,
        audioBitrate: config.processing.audioBitrate,
        resolution: config.processing.outputResolution,
      }
    );

    // Step 10: Upload to YouTube + Drive
    await updateStatus(jobId, 'publishing', { step: 'youtube', percent: 0 });
    const { youtubeUrl, driveUrl } = await uploadStep.execute(
      finalFile, jobRecord, config, dryRun
    );

    // Mark completed
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    await updateStatus(jobId, 'completed', { youtubeUrl, driveUrl });
    logger.info({ jobId, elapsed: `${elapsed}s`, youtubeUrl, driveUrl }, 'Pipeline completed');

  } catch (err) {
    logger.error({ jobId, err }, 'Pipeline failed');
    await updateStatus(jobId, 'failed', { error: err.message }).catch(() => {});
    throw err;
  } finally {
    // Clean up work directory
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
      logger.info({ workDir }, 'Cleaned up work directory');
    } catch {
      // Ignore cleanup errors
    }
  }
}

module.exports = { runPipeline };
