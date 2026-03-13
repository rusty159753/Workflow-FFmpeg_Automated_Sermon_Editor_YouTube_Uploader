#!/bin/bash
# Deploy ASP Processing Worker to Google Cloud Run Jobs
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP project created with billing enabled
#   - Cloud Run API enabled
#
# Usage:
#   bash scripts/deploy-worker.sh <PROJECT_ID> [REGION]

set -euo pipefail

PROJECT_ID="${1:?Usage: deploy-worker.sh <PROJECT_ID> [REGION]}"
REGION="${2:-us-central1}"
JOB_NAME="asp-worker"
GCS_BUCKET="asp-staging-${PROJECT_ID}"

echo "=== Deploying ASP Worker Job ==="
echo "  Project:  ${PROJECT_ID}"
echo "  Region:   ${REGION}"
echo "  Job:      ${JOB_NAME}"
echo ""

# Build and push container image
echo "Building container image..."
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --tag "gcr.io/${PROJECT_ID}/${JOB_NAME}" \
  ./worker

# Check if job exists
if gcloud run jobs describe "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" &>/dev/null; then

  echo "Updating existing Cloud Run Job..."
  gcloud run jobs update "${JOB_NAME}" \
    --project "${PROJECT_ID}" \
    --image "gcr.io/${PROJECT_ID}/${JOB_NAME}" \
    --region "${REGION}" \
    --task-timeout 1800 \
    --memory 4Gi \
    --cpu 2 \
    --max-retries 1 \
    --parallelism 1 \
    --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET=${GCS_BUCKET}"
else
  echo "Creating new Cloud Run Job..."
  gcloud run jobs create "${JOB_NAME}" \
    --project "${PROJECT_ID}" \
    --image "gcr.io/${PROJECT_ID}/${JOB_NAME}" \
    --region "${REGION}" \
    --task-timeout 1800 \
    --memory 4Gi \
    --cpu 2 \
    --max-retries 1 \
    --parallelism 1 \
    --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET=${GCS_BUCKET}"
fi

echo ""
echo "=== Deployment Complete ==="
echo "  Job Name: ${JOB_NAME}"
echo "  Memory:   4 GiB"
echo "  CPUs:     2"
echo "  Timeout:  30 minutes"
