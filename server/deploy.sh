#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-phantom-auth0-server}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "Building isolated Phantom Auth0 server image..."
gcloud builds submit --tag "${IMAGE}" .

echo "Deploying isolated Cloud Run service..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 3600

echo "Done."
gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)'
