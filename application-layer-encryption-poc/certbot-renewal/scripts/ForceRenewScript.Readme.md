#!/bin/sh
set -eu

NS=application-layer-certbot
ACME_SERVER=https://pebble:14000/dir
CERT_NAME=internal-service
CERT_DNS=internal-service.application-layer-encryption.svc.cluster.local
TEST_DNS=internal-service-oneway.application-layer-certbot.svc.cluster.local
ROOT_CA=/etc/letsencrypt/pebble-root.pem

mkdir -p /etc/letsencrypt

if [ ! -s "$ROOT_CA" ]; then
  curl -kfsS https://pebble:15000/roots/0 -o "$ROOT_CA"
fi

export REQUESTS_CA_BUNDLE="$ROOT_CA"

if [ "${RUN_MODE:-issue}" = "issue" ]; then
  certbot certonly \
      --no-verify-ssl \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --server "$ACME_SERVER" \
    --standalone \
    --http-01-port 5002 \
    --preferred-challenges http \
    --cert-name "$CERT_NAME" \
    --key-type rsa \
    --rsa-key-size 2048 \
    -d "$CERT_DNS" \
    -d "$TEST_DNS"
else
  certbot renew \
      --no-verify-ssl \
    --non-interactive \
    --force-renewal \
    --no-random-sleep-on-renew
fi

CRT="/etc/letsencrypt/live/$CERT_NAME/fullchain.pem"
KEY="/etc/letsencrypt/live/$CERT_NAME/privkey.pem"

test -s "$CRT"
test -s "$KEY"

kubectl create secret tls certbot-internal-service-tls \
  -n "$NS" \
  --cert="$CRT" \
  --key="$KEY" \
  --dry-run=client -o yaml |
  kubectl apply -f -

kubectl create configmap pebble-root \
  -n "$NS" \
  --from-file=pebble-root.pem="$ROOT_CA" \
  --dry-run=client -o yaml |
  kubectl apply -f -

kubectl rollout restart deployment/internal-service-oneway -n "$NS"

URL="https://$CERT_DNS:9443/"

echo "=== Trusted CA test ==="
SUCCESS=0
for i in $(seq 1 30); do
  if curl --silent --show-error --fail \
    --cacert "$ROOT_CA" \
    --connect-to "$CERT_DNS:9443:$TEST_DNS:9443" \
    "$URL"; then
    SUCCESS=1
    break
  fi
  sleep 2
done

if [ "$SUCCESS" -ne 1 ]; then
  echo "FAIL: trusted one-way TLS request"
  exit 1
fi
echo "PASS: trusted one-way TLS request"

echo "=== Untrusted CA test ==="
if curl --silent --show-error --fail \
  --cacert /etc/ssl/cert.pem \
  --connect-to "$CERT_DNS:9443:$TEST_DNS:9443" \
  "$URL"; then
  echo "FAIL: untrusted CA was accepted"
  exit 1
else
  echo "PASS: untrusted CA rejected"
fi

echo "=== Certificate details ==="
openssl x509 -in "$CRT" -noout \
  -subject -issuer -serial -dates -ext subjectAltName

echo "=== Secret updated ==="
kubectl get secret certbot-internal-service-tls -n "$NS"
