# ASP Setup Guide

Complete setup from a fresh GCP project to a working deployment.

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Node.js 20+ installed locally
- A GitHub account (for frontend hosting)

## Step 1: Create GCP Project

```bash
gcloud projects create asp-yourchurch --name="Automated Sermon Publisher"
gcloud config set project asp-yourchurch
gcloud billing projects link asp-yourchurch --billing-account=YOUR_BILLING_ACCOUNT
```

## Step 2: Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  youtube.googleapis.com \
  drive.googleapis.com
```

## Step 3: Create GCS Bucket

```bash
PROJECT_ID=$(gcloud config get-value project)
BUCKET="asp-staging-${PROJECT_ID}"

gsutil mb -l us-central1 "gs://${BUCKET}"

# Set lifecycle rule: delete objects older than 7 days
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 7 }
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json "gs://${BUCKET}"

# Set CORS for browser uploads
cat > /tmp/cors.json << 'EOF'
[
  {
    "origin": ["https://rusty159753.github.io"],
    "method": ["PUT", "GET"],
    "responseHeader": ["Content-Type", "Content-Range", "Content-Length"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set /tmp/cors.json "gs://${BUCKET}"
```

## Step 4: Create OAuth Credentials

1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials > OAuth client ID**
3. Select **Desktop app** as the application type
4. Name it "ASP Desktop Client"
5. Download the JSON file (you'll need the client ID and secret)

## Step 5: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Set up as **External** (or Internal if using Google Workspace)
3. Add scopes:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/drive.file`
4. Add your email as a test user

## Step 6: Run OAuth Setup Script

```bash
cd scripts
npm install --prefix ../api  # Install dependencies

node setup-oauth.js \
  --client-id=YOUR_CLIENT_ID \
  --client-secret=YOUR_CLIENT_SECRET \
  --project-id=asp-yourchurch
```

This opens a browser for you to authorize, then stores the refresh token in Secret Manager.

## Step 7: Create Drive Folder Structure

```bash
node create-drive-folders.js --project-id=asp-yourchurch
```

Copy the output folder IDs into `api/config.yaml` and `worker/config.yaml`.

## Step 8: Set Admin Token

```bash
# Generate a random admin token
ADMIN_TOKEN=$(openssl rand -hex 32)
echo "Your admin token: ${ADMIN_TOKEN}"

# Store in Secret Manager
echo -n "${ADMIN_TOKEN}" | gcloud secrets create asp-admin-secret \
  --data-file=- \
  --project=asp-yourchurch
```

Save this token securely — you'll use it to access the admin page.

## Step 9: Update Configuration

Edit `api/config.yaml` and `worker/config.yaml`:
- Set `gcp_project_id` to your project ID
- Set `gcs_bucket` to your bucket name
- Set all Drive folder IDs from Step 7
- Customize YouTube description footer, privacy setting, etc.

## Step 10: Deploy API Service

```bash
bash scripts/deploy-api.sh asp-yourchurch us-central1
```

Note the Cloud Run service URL in the output.

## Step 11: Deploy Worker

```bash
bash scripts/deploy-worker.sh asp-yourchurch us-central1
```

## Step 12: Update Frontend API URL

Edit `frontend/js/api-client.js` and replace the Cloud Run URL placeholder:

```javascript
return 'https://asp-api-abc123-uc.a.run.app';  // Your actual URL
```

## Step 13: Deploy Frontend

Push the `frontend/` directory to your GitHub Pages repo. The GitHub Actions workflow will auto-deploy on pushes to `main`.

## Step 14: Verify

1. Open the frontend URL in your browser
2. Open the admin page and log in with your admin token
3. Upload intro and outro videos via the admin page
4. Upload a test sermon with dry-run mode enabled
5. Verify the pipeline completes successfully
6. Disable dry-run and test a real upload

## IAM Permissions

Ensure the Cloud Run service accounts have the correct roles:

```bash
PROJECT_ID=$(gcloud config get-value project)
API_SA="asp-api@${PROJECT_ID}.iam.gserviceaccount.com"
WORKER_SA="asp-worker@${PROJECT_ID}.iam.gserviceaccount.com"

# API service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${API_SA}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${API_SA}" \
  --role="roles/run.invoker"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${API_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Worker service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${WORKER_SA}" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${WORKER_SA}" \
  --role="roles/secretmanager.secretAccessor"
```
