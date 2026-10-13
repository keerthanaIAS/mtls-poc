#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

NODE_TEST='
const https = require("https");
const req = https.get({
  hostname: "127.0.0.1",
  port: 8443,
  path: "/api/transaction",
  rejectUnauthorized: false,
  timeout: 4000
}, res => {
  console.log("UNEXPECTED_HTTP_RESPONSE:" + res.statusCode);
  res.resume();
  process.exitCode = 2;
});
req.on("timeout", () => req.destroy(new Error("TEST_TIMEOUT")));
req.on("error", err => {
  console.log("TLS_REJECTED:" + err.code + ":" + err.message);
  if (String(err.code || "").includes("CERTIFICATE_REQUIRED") ||
      /certificate required|peer did not return a certificate|alert.*certificate/i.test(err.message)) {
    process.exitCode = 0;
  } else {
    process.exitCode = 3;
  }
});
'

test_missing_cert() {
  local engine="$1"
  local container="$2"
  local output rc

  output="$("$engine" exec "$container" node -e "$NODE_TEST" 2>&1)"
  rc=$?

  echo "$engine missing-client-certificate test:"
  echo "$output"

  if [[ "$rc" -eq 0 ]] && echo "$output" | grep -q 'TLS_REJECTED:'; then
    record_result "missing-client-cert-$engine" "PASS" "TLS connection rejected without client certificate"
  elif echo "$output" | grep -q 'UNEXPECTED_HTTP_RESPONSE:'; then
    record_result "missing-client-cert-$engine" "FAIL" "Server accepted a connection without a client certificate"
    return 1
  else
    record_result "missing-client-cert-$engine" "INCONCLUSIVE" "Could not confirm the expected certificate-required rejection; exit=$rc"
    return 1
  fi
}

failed=0
test_missing_cert docker "$DOCKER_TRANSACTION" || failed=1
test_missing_cert podman "$PODMAN_TRANSACTION" || failed=1

[[ "$failed" -eq 0 ]]
