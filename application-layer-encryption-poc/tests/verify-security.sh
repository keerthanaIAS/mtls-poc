#!/bin/bash

set -u

NAMESPACE="application-layer-encryption"
CA_FILE="k8s/certs/ca.crt"
FAILED=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILED=1; }

echo "=========================================="
echo " mTLS + Application Encryption Verification"
echo "=========================================="

# 1. Verify both Kubernetes deployments are healthy.
echo
echo "[1/6] Checking Kubernetes deployments"

if kubectl rollout status deployment/gateway \
  -n "$NAMESPACE" --timeout=30s &&
   kubectl rollout status deployment/internal-service \
  -n "$NAMESPACE" --timeout=30s; then
  pass "Gateway and internal service are running"
else
  fail "Kubernetes deployments are not healthy"
fi

# 2. Verify positive API and replay-protection tests.
echo
echo "[2/6] Running existing security suite"

if node tests/security-suite.js; then
  pass "API validation and replay-protection tests"
else
  fail "Security suite"
fi

# 3. Verify encrypted-payload tampering is rejected.
echo
echo "[3/6] Running payload-tampering test"

if node tests/tamper.js; then
  pass "Tampered encrypted payload rejected"
else
  fail "Payload-tampering test"
fi

# 4. Verify external client mTLS rejects a client without a certificate.
echo
echo "[4/6] Checking external mTLS rejection"

if [ ! -f "$CA_FILE" ]; then
  fail "CA certificate not found: $CA_FILE"
else
  node - "$CA_FILE" <<'NODE'
const tls = require("tls");
const fs = require("fs");

const ca = fs.readFileSync(process.argv[2]);
const https = require("https");

const req = https.request({
  host: "127.0.0.1",
  port: 8443,
  path: "/",
  method: "GET",
  ca,
  rejectUnauthorized: true,
  timeout: 4000
}, (res) => {
  console.error("FAIL: Gateway returned HTTP " + res.statusCode +
    " without a client certificate");
  res.resume();
  process.exitCode = 1;
});

req.on("error", (err) => {
  if (/certificate required|alert certificate|socket hang up|reset/i.test(err.message)) {
    console.log("PASS: Gateway rejected the client without a certificate");
  } else {
    console.error("FAIL: Could not confirm external mTLS rejection:", err.message);
    process.exitCode = 1;
  }
});

req.on("timeout", () => req.destroy(new Error("TLS request timed out")));
req.end();
NODE
  [ $? -eq 0 ] || fail "External mTLS negative test"
fi

# 5. Verify internal service mTLS rejects a gateway connection without a client certificate.
echo
echo "[5/6] Checking internal-service mTLS rejection"

REMOTE_TEST='
const https = require("https");
const fs = require("fs");

const ca = fs.readFileSync("/app/certs/ca.crt");

const req = https.request({
  host: "internal-service.application-layer-encryption.svc.cluster.local",
  port: 9443,
  path: "/",
  method: "GET",
  ca,
  rejectUnauthorized: true,
  timeout: 4000
}, (res) => {
  console.error("FAIL: Internal service returned HTTP " + res.statusCode +
    " without a client certificate");
  res.resume();
  process.exitCode = 1;
});

req.on("error", (err) => {
  if (/certificate required|alert certificate|socket hang up|ECONNRESET/i.test(
      err.message + " " + (err.code || ""))) {
    console.log("PASS: Internal service rejected client without a certificate");
  } else {
    console.error("FAIL: Could not confirm internal mTLS rejection:",
      err.message, err.code || "");
    process.exitCode = 1;
  }
});

req.end();
' 

if kubectl exec -n "$NAMESPACE" deployment/gateway -- \
  node -e "$REMOTE_TEST"; then
  pass "Internal service requires a client certificate"
else
  fail "Internal mTLS negative test"
fi

# 6. Confirm the deployed source has the expected encryption primitives.
echo
echo "[6/6] Checking application-layer encryption implementation"

if grep -R -E 'aes-256-gcm|RSA-OAEP|oaepHash' \
  k8s/gateway k8s/internal-service >/dev/null 2>&1; then
  pass "Encryption implementation markers found in source"
else
  fail "Could not find expected AES-GCM/RSA-OAEP markers"
fi

echo
echo "=========================================="
if [ "$FAILED" -eq 0 ]; then
  echo "RESULT: ALL VERIFICATION CHECKS PASSED"
else
  echo "RESULT: ONE OR MORE CHECKS FAILED"
  echo "Review the failed check above before claiming success."
fi
echo "=========================================="

exit "$FAILED"
