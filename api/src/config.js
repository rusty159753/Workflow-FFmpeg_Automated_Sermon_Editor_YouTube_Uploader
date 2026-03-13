const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const configPath = path.join(__dirname, '..', 'config.yaml');
const raw = yaml.load(fs.readFileSync(configPath, 'utf8'));

// Allow environment variable overrides
const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID || raw.gcp_project_id,
  gcsBucket: process.env.GCS_BUCKET || raw.gcs_bucket,
  gcsRegion: raw.gcs_region,

  secrets: {
    oauthClientId: raw.secrets.oauth_client_id,
    oauthClientSecret: raw.secrets.oauth_client_secret,
    oauthRefreshToken: raw.secrets.oauth_refresh_token,
  },

  drive: {
    rootFolderId: process.env.DRIVE_ROOT_FOLDER_ID || raw.drive.root_folder_id,
    introFolderId: process.env.DRIVE_INTRO_FOLDER_ID || raw.drive.intro_folder_id,
    outroFolderId: process.env.DRIVE_OUTRO_FOLDER_ID || raw.drive.outro_folder_id,
    outputFolderId: process.env.DRIVE_OUTPUT_FOLDER_ID || raw.drive.output_folder_id,
    logsFolderId: process.env.DRIVE_LOGS_FOLDER_ID || raw.drive.logs_folder_id,
  },

  processing: {
    crossfadeDuration: raw.processing.crossfade_duration,
    targetLufs: raw.processing.target_lufs,
    truePeakDbtp: raw.processing.true_peak_dbtp,
    outputResolution: raw.processing.output_resolution,
    videoCrf: raw.processing.video_crf,
    audioBitrate: raw.processing.audio_bitrate,
    trimBuffer: raw.processing.trim_buffer,
  },

  youtube: {
    defaultPrivacy: raw.youtube.default_privacy,
    defaultCategoryId: raw.youtube.default_category_id,
    descriptionFooter: raw.youtube.description_footer,
  },

  upload: {
    maxFileSizeGb: raw.upload.max_file_size_gb,
    acceptedExtensions: raw.upload.accepted_extensions,
  },

  features: {
    dryRun: process.env.DRY_RUN === 'true' || raw.features.dry_run,
  },

  frontend: {
    origin: process.env.FRONTEND_ORIGIN || raw.frontend.origin,
  },

  admin: {
    secretName: raw.admin.secret_name,
  },

  cloudRun: {
    workerJobName: raw.cloud_run.worker_job_name,
    region: raw.cloud_run.region,
  },
};

module.exports = config;
