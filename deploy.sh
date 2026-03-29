#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-your-gcp-project}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-phantom-auth0-server}"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/phantom-auth0/${SERVICE_NAME}:latest"
REPO="youneslaaroussi/phantom-auth0"

echo "=== Phantom Auth0 Deployment ==="
echo "This script is isolated from the original Phantom deployment."
echo ""

echo "[1/3] Building server Docker image..."
docker build --platform linux/amd64 -t "${IMAGE}" ./server

echo "[2/3] Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "[3/3] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 3600 \
  --set-env-vars "PUBLIC_BASE_URL=https://${SERVICE_NAME}-${PROJECT_ID}.${REGION}.run.app"

SERVER_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')

echo ""
echo "=== Deployment complete ==="
echo "Server: ${SERVER_URL}"
echo "Repo:   https://github.com/${REPO}"
