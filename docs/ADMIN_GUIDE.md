# ASP Admin Guide

For the person who manages the ASP system.

## Accessing the Admin Page

1. Navigate to `your-site.github.io/admin.html`
2. Enter your admin token (set during initial setup)
3. The token is stored in your browser session — you'll need to re-enter it after closing the browser

## Managing Intro/Outro Assets

The intro and outro videos are stored in Google Drive and automatically prepended/appended to every sermon with a 1-second crossfade transition.

### Uploading a New Intro/Outro

1. Go to the admin page
2. Under "Intro Video" or "Outro Video," click **Choose File**
3. Select your video file (MP4 recommended, same resolution as sermons)
4. Click **Upload New Intro** (or Outro)

The new asset replaces the previous one. The system always uses the most recently uploaded file.

### Asset Requirements

- **Format**: MP4 with H.264 video and AAC audio
- **Resolution**: Match your sermon recordings (typically 1080p)
- **Audio**: Stereo, 48 kHz sample rate
- **Duration**: Keep intros under 30 seconds and outros under 60 seconds

## Dry-Run Mode

Dry-run mode runs the entire processing pipeline (trim, normalize, stitch, encode) but skips the actual YouTube upload and Google Drive archive. Use this for testing.

### When to Use

- Testing a new intro/outro asset
- Verifying trim points work correctly
- Debugging processing issues without wasting YouTube quota

### How to Toggle

1. Go to the admin page
2. Toggle the **Dry Run** switch on or off
3. The setting takes effect on the next job that starts processing

## Configuration

The admin page shows the current non-sensitive configuration:

| Setting | Description |
|---------|-------------|
| GCS Bucket | Cloud Storage bucket for staging |
| Target LUFS | Audio loudness target (-14 LUFS by default) |
| Crossfade Duration | Transition duration between intro/sermon/outro |
| Video CRF | H.264 quality (18 = high quality) |
| Audio Bitrate | AAC bitrate (192k) |
| Output Resolution | Final video resolution (1920x1080) |
| YouTube Privacy | Default privacy setting (unlisted) |

To change these settings, edit `api/config.yaml` and `worker/config.yaml` and redeploy.

## Monitoring Jobs

### Check Job Status via API

```bash
curl https://your-api-url.run.app/api/jobs/JOB_ID/status
```

### View Cloud Run Logs

```bash
# API service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=asp-api" --limit=50

# Worker job logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=asp-worker" --limit=50
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "No intro file found" | Assets folder is empty | Upload intro/outro via admin page |
| "FFmpeg exited with code 1" | Processing error | Check worker logs for FFmpeg stderr |
| Upload URL expired | Took too long to upload | Try again — URLs are valid for 1 hour |
| YouTube quota exceeded | Too many uploads in one day | Wait 24 hours (limit ~6 uploads/day) |
| 403 on admin endpoints | Invalid or expired token | Re-enter your admin token |

### YouTube API Quotas

YouTube Data API v3 has a daily quota of 10,000 units. Each video upload costs ~1,600 units, allowing approximately 6 uploads per day. Plan accordingly for busy Sundays.

### Reprocessing a Failed Job

If a job fails, simply upload the sermon again through the upload page. Each upload creates a new independent job.

### Updating OAuth Credentials

If the refresh token expires or you need to re-authorize:

```bash
node scripts/setup-oauth.js \
  --client-id=YOUR_CLIENT_ID \
  --client-secret=YOUR_CLIENT_SECRET \
  --project-id=YOUR_PROJECT_ID
```

### Cleanup

Staging files in GCS are automatically deleted after 7 days via a bucket lifecycle rule. No manual cleanup is needed.
