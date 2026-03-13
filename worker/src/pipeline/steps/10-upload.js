const youtubeService = require('../../services/youtube');
const driveService = require('../../services/drive');
const pino = require('pino');

const logger = pino({ name: 'step-upload' });

/**
 * Upload the final video to YouTube and archive to Google Drive.
 *
 * @param {string} finalFile - Path to the final encoded video
 * @param {object} jobRecord - Job metadata
 * @param {object} config - Config with Drive folder IDs, YouTube settings, etc.
 * @param {boolean} dryRun - Skip actual uploads if true
 * @returns {Promise<{ youtubeUrl: string, driveUrl: string }>}
 */
async function execute(finalFile, jobRecord, config, dryRun = false) {
  // Build YouTube metadata
  const ytTitle = `${jobRecord.sermonDate} - ${jobRecord.sermonTitle} - ${jobRecord.speaker}`;
  const ytDescription = [
    jobRecord.sermonTitle,
    `Speaker: ${jobRecord.speaker}`,
    `Date: ${jobRecord.sermonDate}`,
    jobRecord.series ? `Series: ${jobRecord.series}` : null,
    '',
    config.youtube.descriptionFooter || '',
  ].filter(Boolean).join('\n');

  // Upload to YouTube
  logger.info({ title: ytTitle }, 'Uploading to YouTube');
  const youtubeUrl = await youtubeService.uploadVideo(finalFile, {
    title: ytTitle,
    description: ytDescription,
    privacyStatus: config.youtube.defaultPrivacy,
    categoryId: config.youtube.defaultCategoryId,
  }, dryRun);

  // Upload to Drive archive
  const driveFileName = `${jobRecord.sermonDate} - ${jobRecord.sermonTitle} - ${jobRecord.speaker}.mp4`;
  logger.info({ fileName: driveFileName }, 'Archiving to Google Drive');
  const driveUrl = await driveService.uploadFile(
    finalFile,
    driveFileName,
    config.drive.outputFolderId,
    dryRun
  );

  logger.info({ youtubeUrl, driveUrl }, 'All uploads complete');
  return { youtubeUrl, driveUrl };
}

module.exports = { execute };
