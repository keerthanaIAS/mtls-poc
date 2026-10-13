#!/usr/bin/env bash

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOMATION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$AUTOMATION_DIR/config/test-config.env"

mkdir -p "$RESULTS_DIR"

record_result() {
  local test_name="$1"
  local status="$2"
  local details="${3:-}"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

  if [[ ! -f "$STATUS_FILE" ]]; then
    echo "timestamp,test,status,details" > "$STATUS_FILE"
  fi

  details="${details//,/;}"
  details="${details//$'\n'/ }"
  echo "\"$timestamp\",\"$test_name\",\"$status\",\"$details\"" >> "$STATUS_FILE"
  printf '[%s] %s — %s\n' "$status" "$test_name" "$details"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    return 1
  fi
}

container_is_running() {
  local engine="$1"
  local container="$2"
  "$engine" inspect -f '{{.State.Running}}' "$container" 2>/dev/null |
    grep -qx 'true'
}
