#!/usr/bin/env bash
# Run from the terraform/shadow-replay/function/ directory.
# Produces shadow-forwarder.zip in the parent terraform/shadow-replay/ directory,
# which is the path Terraform expects via filebase64sha256("${path.module}/shadow-forwarder.zip").
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_ZIP="${SCRIPT_DIR}/../shadow-forwarder.zip"

echo "Packaging Lambda function..."
zip -j "${OUTPUT_ZIP}" "${SCRIPT_DIR}/index.js"
echo "Created: ${OUTPUT_ZIP}"
