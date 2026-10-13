#!/usr/bin/env bash

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

# Start a fresh status and load-results file for each full run.
echo 'timestamp,test,status,details' > "$RESULTS_DIR/status.csv"
echo 'engine,concurrency,requests,successes,failures,elapsed_seconds,requests_per_second' \
  > "$RESULTS_DIR/load-results.csv"

run_step() {
  local script="$1"
  local log="$RESULTS_DIR/$(basename "$script" .sh).log"

  echo
  echo "=================================================="
  echo "Running: $script"
  echo "Log: $log"
  echo "=================================================="

  if bash "$SCRIPT_DIR/$script" 2>&1 | tee "$log"; then
    echo "Completed: $script"
  else
    echo "STOPPED: $script failed. Fix the issue before continuing."
    echo "Previous results and logs are retained in: $RESULTS_DIR"
    exit 1
  fi
}

run_step "scripts/01-check-environment.sh"
run_step "scripts/02-validate-certificates.sh"
run_step "scripts/03-test-positive-mtls.sh"
run_step "scripts/04-test-negative-mtls.sh"
run_step "scripts/05-test-service-communication.sh"
run_step "scripts/06-run-load-tests.sh"
run_step "scripts/07-monitor-resources.sh"
run_step "scripts/08-generate-report.sh"

echo
echo "All automation steps completed."
echo "Review: $RESULTS_DIR/final-report.txt"
