# ASP User Guide

For church volunteers who upload sermon recordings.

## How to Upload a Sermon

### 1. Open the Upload Page

Navigate to the ASP upload page in your web browser. You should see a form titled "Upload Sermon Recording."

### 2. Fill Out Sermon Details

- **Sermon Title** (required): The title of the sermon, e.g., "The Good Shepherd"
- **Date** (required): The date the sermon was preached
- **Speaker** (required): The speaker's name, e.g., "Pastor John Smith"
- **Series** (optional): The sermon series name, e.g., "Gospel of John"

### 3. Set Trim Points (Optional)

If the recording has dead time at the beginning or end, you can trim it:

- **Trim Start**: When the sermon content begins (e.g., `0:02:30` for 2 minutes 30 seconds in)
- **Trim End**: When the sermon content ends (e.g., `1:15:00` for 1 hour 15 minutes)

Leave these blank to use the full recording. A 2-second buffer is automatically added around your trim points to avoid cutting off content.

### 4. Select Video File(s)

Click the file selection area or drag and drop your video file(s). Supported formats: MP4, MOV, MTS, M2TS.

If the recording was split across multiple files (e.g., the camera stopped and restarted), select all files in order. They will be automatically concatenated.

### 5. Upload and Process

Click **Upload & Process**. You'll see:

1. **Upload progress** — each file uploads directly to cloud storage
2. **Processing pipeline** — the system automatically:
   - Joins split files together
   - Trims to your specified points
   - Normalizes the audio volume
   - Adds the intro and outro with smooth transitions
   - Encodes the final video at high quality (1080p)
3. **Publishing** — uploads to YouTube and archives to Google Drive

### 6. Done!

When processing is complete, you'll see links to:
- The YouTube video (published as unlisted by default)
- The Google Drive archive copy

## Tips

- **Large files**: Uploads can take several minutes for long recordings. Don't close the browser tab during upload.
- **File format**: MP4 is preferred. If you have MTS files from a camcorder, those work too.
- **Trim points**: It's better to trim a little loose (include extra time) than too tight. The system adds a 2-second buffer automatically.
- **Multiple files**: If selecting multiple files, make sure they're in the correct order. The system concatenates them in the order they appear.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Upload stalls | Check your internet connection. Refresh the page and try again. |
| "Processing failed" | Note the error message and contact the admin. |
| Wrong trim points | Upload the sermon again with corrected trim times. |
| Video looks interlaced | The system auto-detects and deinterlaces — this should be handled automatically. |
