#!/bin/bash
# Usage: ./docker-build-push.sh <image_name> <dockerfile_path> <acr_name> <repo_url> <tag>
# Example: ./docker-build-push.sh marketforge-ci .github/docker/ci.Dockerfile myacr.azurecr.io myacr.azurecr.io/marketforge-ci latest

set -euo pipefail

IMAGE_NAME="$1"
DOCKERFILE_PATH="$2"
ACR_NAME="$3"
REPO_URL="$4"
TAG="${5:-latest}"

echo "Building Docker image: $REPO_URL:$TAG from $DOCKERFILE_PATH ..."
docker build -t "$REPO_URL:$TAG" -f "$DOCKERFILE_PATH" .

# Get local image digest
echo "Getting local image digest..."
LOCAL_DIGEST=$(docker images --no-trunc --quiet "$REPO_URL:$TAG")
echo "Local digest: $LOCAL_DIGEST"


# Write digest to a unique file per image for CI/CD use
SHA_FILE="$(pwd)/azure-deploy/sha-${IMAGE_NAME}.txt"
mkdir -pv "$(dirname "$SHA_FILE")"
echo "$LOCAL_DIGEST" > "$SHA_FILE"
echo "Digest written to $SHA_FILE"

# Output digest for use in CI/CD
echo "$LOCAL_DIGEST"
