#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

{
  echo "Resource snapshot: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "=== Docker ==="
  docker stats --no-stream "$DOCKER_ROOT" "$DOCKER_TRANSACTION" 2>&1
  echo
  echo "=== Podman ==="
  podman stats --no-stream "$PODMAN_ROOT" "$PODMAN_TRANSACTION" 2>&1
} | tee "$RESOURCE_RESULTS"

if grep -q 'Error' "$RESOURCE_RESULTS"; then
  record_result "resource-snapshot" "INCONCLUSIVE" "One or more resource commands reported an error; inspect resource-usage.txt"
  exit 1
fi

record_result "resource-snapshot" "PASS" "Docker and Podman resource snapshots saved"
