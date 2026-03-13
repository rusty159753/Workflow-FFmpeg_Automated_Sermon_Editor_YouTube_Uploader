#!/bin/bash
# Deploy ASP API Service to Google Cloud Run
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP project created with billing enabled
#   - Cloud Run API enabled
#
# Usage:
#   bash scripts/deploy-api.sh <PROJECT_ID> [REGION]

set -euo pipefail

PROJECT_ID="${1:?Usage: deploy-api.sh <PROJECT_ID> [REGION]}"
REGION="${2:-us-central1}"
SERVICE_NAME="asp-api"
GCS_BUCKET="asp-staging-${PROJECT_ID}"

echo "=== Deploying ASP API Service ==="
echo "  Project:  ${PROJECT_ID}"
echo "  Region:   ${REGION}"
echo "  Service:  ${SERVICE_NAME}"
echo ""

# Build and push container image
echo "Building container image..."
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" \
  ./api

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --image "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET=${GCS_BUCKET}" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 60 \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format "value(status.url)")

echo ""
echo "=== Deployment Complete ==="
echo "  Service URL: ${SERVICE_URL}"
echo ""
echo "  IMPORTANT: Update frontend/js/api-client.js with this URL."
echo "  IMPORTANT: Update the GCS bucket CORS config to allow your frontend origin."
