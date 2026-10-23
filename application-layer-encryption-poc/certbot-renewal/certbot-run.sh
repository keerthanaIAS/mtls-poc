#!/bin/sh
set -eu

NS=application-layer-certbot
ACME_SERVER=https://pebble:14000/dir
CERT_NAME=internal-service
CERT_DNS=internal-service.application-layer-encryption.svc.cluster.local
TEST_DNS=internal-service-oneway.application-layer-certbot.svc.cluster.local
ROOT_CA=/etc/letsencrypt/pebble-root.pem
RENEWAL_CONF=/etc/letsencrypt/renewal/${CERT_NAME}.conf
CRT=/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem
KEY=/etc/letsencrypt/live/${CERT_NAME}/privkey.pem

mkdir -p /etc/letsencrypt

curl -kfsS https://pebble:15000/roots/0 -o "$ROOT_CA"
openssl x509 -in "$ROOT_CA" -noout -subject -fingerprint -sha256
export REQUESTS_CA_BUNDLE="$ROOT_CA"

set_renewal_window() {
  if grep -q '^renew_before_expiry[[:space:]]*=' "$RENEWAL_CONF"; then
    sed -i 's/^renew_before_expiry[[:space:]]*=.*/renew_before_expiry = 2 minutes/' "$RENEWAL_CONF"
  else
    awk '
      /^\[renewalparams\]/ {
        print
        print "renew_before_expiry = 2 minutes"
        next
      }
      { print }
    ' "$RENEWAL_CONF" > "${RENEWAL_CONF}.tmp"
    mv "${RENEWAL_CONF}.tmp" "$RENEWAL_CONF"
  fi
}

if [ "${RUN_MODE:-renew}" = "issue" ]; then
  if [ -f "$RENEWAL_CONF" ]; then
    certbot delete --non-interactive --cert-name "$CERT_NAME"
  fi

  rm -rf /etc/letsencrypt/accounts/*

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

  set_renewal_window
else
  if [ ! -s "$CRT" ] || [ ! -f "$RENEWAL_CONF" ]; then
    echo "FAIL: certificate or renewal configuration missing"
    exit 1
  fi

  set_renewal_window

  echo "=== Certificate BEFORE renewal check ==="
  openssl x509 -in "$CRT" -noout -serial -dates

  certbot renew \
    --no-verify-ssl \
    --non-interactive \
    --no-random-sleep-on-renew
fi

test -s "$CRT"
test -s "$KEY"

echo "=== Certificate AFTER Certbot ==="
openssl x509 -in "$CRT" -noout -serial -dates

kubectl create secret tls certbot-internal-service-tls \
  -n "$NS" --cert="$CRT" --key="$KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap pebble-root \
  -n "$NS" --from-file=pebble-root.pem="$ROOT_CA" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/internal-service-oneway -n "$NS"
kubectl rollout status deployment/internal-service-oneway -n "$NS" --timeout=120s

echo "=== Trusted CA API test ==="
curl --silent --show-error --fail \
  --cacert "$ROOT_CA" \
  --connect-to "$CERT_DNS:9443:$TEST_DNS:9443" \
  "https://$CERT_DNS:9443/"

echo
echo "PASS: trusted CA API request"

echo "=== Untrusted CA API test ==="
if curl --silent --show-error --fail \
  --cacert /etc/ssl/cert.pem \
  --connect-to "$CERT_DNS:9443:$TEST_DNS:9443" \
  "https://$CERT_DNS:9443/" >/dev/null 2>&1; then
  echo "FAIL: untrusted CA was accepted"
  exit 1
else
  echo "PASS: untrusted CA rejected"
fi

echo "=== Certificate SANs ==="
openssl x509 -in "$CRT" -noout -text | grep 'DNS:'

echo "=== Updated Kubernetes Secret ==="
kubectl get secret certbot-internal-service-tls -n "$NS"
