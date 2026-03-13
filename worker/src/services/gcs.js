const { Storage } = require('@google-cloud/storage');
const pino = require('pino');

const logger = pino({ name: 'worker-gcs' });

let storage;
let bucket;

function init() {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) throw new Error('GCS_BUCKET env not set');
  storage = new Storage();
  bucket = storage.bucket(bucketName);
}

async function downloadFile(gcsPath, localPath) {
  if (!bucket) init();
  await bucket.file(gcsPath).download({ destination: localPath });
  logger.info({ gcsPath, localPath }, 'Downloaded from GCS');
}

async function uploadFile(localPath, gcsPath, contentType) {
  if (!bucket) init();
  const opts = { destination: gcsPath };
  if (contentType) opts.metadata = { contentType };
  await bucket.upload(localPath, opts);
  logger.info({ localPath, gcsPath }, 'Uploaded to GCS');
}

async function downloadJson(gcsPath) {
  if (!bucket) init();
  const [content] = await bucket.file(gcsPath).download();
  return JSON.parse(content.toString('utf8'));
}

async function uploadJson(gcsPath, data) {
  if (!bucket) init();
  await bucket.file(gcsPath).save(JSON.stringify(data, null, 2), {
    contentType: 'application/json',
    resumable: false,
  });
}

module.exports = { downloadFile, uploadFile, downloadJson, uploadJson };
