# Automated Sermon Publisher (ASP)

A browser-based workflow that allows non-technical church volunteers to upload sermon recordings, automatically process them (trim, normalize audio, stitch intro/outro with crossfades), and publish to YouTube + Google Drive.

## Architecture

```
Volunteer Browser                 GitHub Pages
     |                                |
     |  1. Fill form + upload files   |
     +------------------------------->|
     |                                |
     |  2. Upload video to GCS        |   Cloud Run Service (API)
     +------------------------------->+----------->|
     |                                |            |
     |  3. Poll job status            |   3a. Trigger worker
     |<------------------------------>|----------->|
     |                                |            |
     |                                |   Cloud Run Job (Worker)
     |                                |        |
     |                                |   4. Download from GCS
     |                                |   5. FFmpeg pipeline
     |                                |   6. Upload to YouTube
     |                                |   7. Archive to Drive
     |  8. Show YouTube + Drive links |        |
     |<-------------------------------+<-------+
```

## Components

| Component | Technology | Location |
|-----------|-----------|----------|
| Frontend | Vanilla HTML/JS/CSS | `frontend/` on GitHub Pages |
| API Service | Node.js + Express | `api/` on Cloud Run Service |
| Processing Worker | Node.js + FFmpeg | `worker/` on Cloud Run Job |
| File Staging | Google Cloud Storage | GCS bucket |
| Assets & Archive | Google Drive | Drive folders |
| Secrets | Google Secret Manager | OAuth creds, admin token |

## FFmpeg Processing Pipeline

1. **Concatenate** split files (concat demuxer)
2. **Probe** media properties (detect interlacing, channels, duration)
3. **Deinterlace** if needed (yadif)
4. **Trim** with configurable buffer (default +/- 2 seconds)
5. **Normalize audio** (two-pass EBU R128 loudnorm, -14 LUFS)
6. **Downmix** surround to stereo if needed
7. **Stitch** intro + sermon + outro (1-second crossfades)
8. **Final encode** (H.264 CRF 18, AAC 192k, 1080p, faststart)

## Quick Start

See [SETUP.md](SETUP.md) for complete deployment instructions.

## Documentation

- [SETUP.md](SETUP.md) - GCP project setup and deployment
- [USER_GUIDE.md](USER_GUIDE.md) - Volunteer upload instructions
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) - Admin operations and troubleshooting
