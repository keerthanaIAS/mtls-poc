#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

test_service_call() {
  local engine="$1"
  local url="$2"
  local body code

  body="$(mktemp)"
  code="$(curl -sS --max-time "$CURL_TIMEOUT" \
    -o "$body" -w '%{http_code}' "$url$ROOT_ENDPOINT")"
  local curl_status=$?

  echo "$engine service-to-service response:"
  cat "$body"
  echo

  if [[ "$curl_status" -ne 0 || "$code" != "200" ]]; then
    rm -f "$body"
    record_result "service-call-$engine" "FAIL" "Request failed or did not return HTTP 200"
    return 1
  fi

  if ! node - "$body" "$EXPECTED_CLIENT_CN" <<'NODE'
const fs = require("fs");
const body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expectedCN = process.argv[3];

if (body.authenticatedClient !== expectedCN) {
  console.error("Unexpected authenticatedClient:", body.authenticatedClient);
  process.exit(1);
}
if (!["TLSv1.2", "TLSv1.3"].includes(body.tlsVersion)) {
  console.error("Unexpected or missing TLS version:", body.tlsVersion);
  process.exit(1);
}
console.log("Verified authenticatedClient:", body.authenticatedClient);
console.log("Verified TLS version:", body.tlsVersion);
NODE
  then
    rm -f "$body"
    record_result "service-call-$engine" "FAIL" "Response did not confirm expected client identity and TLS version"
    return 1
  fi

  rm -f "$body"
  record_result "service-call-$engine" "PASS" "HTTP 200, expected client identity and TLS version verified"
}

failed=0
test_service_call docker "$DOCKER_ROOT_URL" || failed=1
test_service_call podman "$PODMAN_ROOT_URL" || failed=1

[[ "$failed" -eq 0 ]]
