#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

test_engine() {
  local engine="$1"
  local url="$2"
  local body code

  body="$(mktemp)"
  code="$(curl -sS --max-time "$CURL_TIMEOUT" \
    -o "$body" -w '%{http_code}' "$url$ROOT_ENDPOINT")"
  local curl_status=$?

  echo "$engine response:"
  cat "$body"
  echo
  rm -f "$body"

  if [[ "$curl_status" -eq 0 && "$code" == "200" ]]; then
    record_result "positive-mtls-$engine" "PASS" "Root endpoint returned HTTP 200"
  else
    record_result "positive-mtls-$engine" "FAIL" "curl_status=$curl_status HTTP=$code"
    return 1
  fi
}

failed=0
test_engine docker "$DOCKER_ROOT_URL" || failed=1
test_engine podman "$PODMAN_ROOT_URL" || failed=1

[[ "$failed" -eq 0 ]]
