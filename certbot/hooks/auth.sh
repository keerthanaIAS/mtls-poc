#!/bin/sh
set -eu

curl --fail --silent --show-error \
  -X POST http://127.0.0.1:8055/add-http01 \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${CERTBOT_TOKEN}\",\"content\":\"${CERTBOT_VALIDATION}\"}"

echo "HTTP-01 challenge registered"
