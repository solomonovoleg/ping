#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-stage}"
if [[ "$ENVIRONMENT" != "stage" && "$ENVIRONMENT" != "prod" ]]; then
  echo "Usage: ./api-hub/scripts/deploy.sh [stage|prod]"
  exit 1
fi

echo "Building API HUB for ${ENVIRONMENT}"
npm run build --prefix api-hub
echo "Done. Deploy artifact from api-hub/dist to ${ENVIRONMENT} host."
