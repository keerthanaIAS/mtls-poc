#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

failed=0

for cmd in docker podman curl openssl node; do
  if require_command "$cmd"; then
    echo "FOUND: $cmd"
  else
    record_result "environment-command-$cmd" "FAIL" "Command unavailable"
    failed=1
  fi
done

for item in \
  "docker:$DOCKER_ROOT" \
  "docker:$DOCKER_TRANSACTION" \
  "podman:$PODMAN_ROOT" \
  "podman:$PODMAN_TRANSACTION"
do
  engine="${item%%:*}"
  container="${item#*:}"

  if container_is_running "$engine" "$container"; then
    echo "RUNNING: $engine container $container"
  else
    record_result "container-$container" "FAIL" "Not running or not found"
    failed=1
  fi
done

if [[ -f "$CLIENT_CERT" && -f "$CLIENT_KEY" && -f "$CA_CERT" ]]; then
  echo "FOUND: configured client certificate, key and CA"
else
  record_result "configured-certificate-files" "FAIL" "One or more configured certificate files are missing"
  failed=1
fi

if [[ "$failed" -eq 0 ]]; then
  record_result "environment-check" "PASS" "Required commands, containers and certificate files found"
  exit 0
fi

record_result "environment-check" "FAIL" "Review the errors above before proceeding"
exit 1
