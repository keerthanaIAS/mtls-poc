#!/bin/sh
set -eu

curl --fail --silent --show-error \
  -X POST http://challtestsrv.certbot-poc.svc.cluster.local:8055/add-http01 \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${CERTBOT_TOKEN}\",\"content\":\"${CERTBOT_VALIDATION}\"}"

echo "HTTP-01 challenge registered"
