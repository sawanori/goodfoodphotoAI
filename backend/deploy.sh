#!/bin/bash

# BananaDish Backend Deployment Script

set -e  # Exit on error

PROJECT_ID="bananadish-app"
REGION="asia-northeast1"
SERVICE_NAME="bananadish-api"

echo "🚀 Deploying BananaDish Backend to Cloud Run..."

# Set project
gcloud config set project $PROJECT_ID

# Check if secrets exist
echo "✓ Checking secrets..."
gcloud secrets describe GEMINI_API_KEY --quiet || {
  echo "❌ Error: GEMINI_API_KEY secret not found. Please create it first."
  exit 1
}

# Build and submit to Cloud Build
echo "✓ Building Docker image..."
gcloud builds submit --config cloudbuild.yaml .

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)' 2>/dev/null || echo "")

echo ""
echo "✅ Deployment complete!"
echo ""
if [ -n "$SERVICE_URL" ]; then
  echo "Service URL: $SERVICE_URL"
  echo ""
  echo "Test the deployment:"
  echo "  curl $SERVICE_URL/health"
else
  echo "Service URL not available yet. Check Cloud Console."
fi
echo ""
