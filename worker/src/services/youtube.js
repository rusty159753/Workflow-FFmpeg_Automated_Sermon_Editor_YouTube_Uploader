const fs = require('fs');
const { getYouTubeClient } = require('./oauth');
const pino = require('pino');

const logger = pino({ name: 'youtube' });

/**
 * Upload a video to YouTube.
 *
 * @param {string} filePath - Local path to the video file
 * @param {object} metadata - Video metadata
 * @param {string} metadata.title - Video title
 * @param {string} metadata.description - Video description
 * @param {string} [metadata.privacyStatus='unlisted'] - Privacy setting
 * @param {string} [metadata.categoryId='29'] - YouTube category
 * @param {boolean} [dryRun=false] - If true, skip actual upload
 * @returns {Promise<string>} YouTube video URL
 */
async function uploadVideo(filePath, metadata, dryRun = false) {
  if (dryRun) {
    logger.info({ title: metadata.title }, 'DRY RUN: Would upload to YouTube');
    return 'https://youtube.com/watch?v=DRY_RUN_PLACEHOLDER';
  }

  const youtube = await getYouTubeClient();
  const fileSize = fs.statSync(filePath).size;

  logger.info({
    title: metadata.title,
    fileSize: `${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`,
  }, 'Uploading to YouTube');

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        categoryId: metadata.categoryId || '29',
      },
      status: {
        privacyStatus: metadata.privacyStatus || 'unlisted',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(filePath),
    },
  });

  const videoId = res.data.id;
  const videoUrl = `https://youtube.com/watch?v=${videoId}`;

  logger.info({ videoId, videoUrl, title: metadata.title }, 'YouTube upload complete');
  return videoUrl;
}

module.exports = { uploadVideo };
