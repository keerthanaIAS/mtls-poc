#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

report="$RESULTS_DIR/final-report.txt"

{
  echo "Automated mTLS Evaluation Report"
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "=== Test status history ==="
  if [[ -f "$STATUS_FILE" ]]; then
    cat "$STATUS_FILE"
  else
    echo "No test status file exists yet."
  fi
  echo
  echo "=== Load-test results ==="
  if [[ -f "$LOAD_RESULTS" ]]; then
    cat "$LOAD_RESULTS"
  else
    echo "No load-test results exist yet."
  fi
  echo
  echo "=== Resource snapshot ==="
  if [[ -f "$RESOURCE_RESULTS" ]]; then
    cat "$RESOURCE_RESULTS"
  else
    echo "No resource snapshot exists yet."
  fi
  echo
  echo "Interpretation note:"
  echo "- PASS means the script verified its stated expected behavior."
  echo "- FAIL means a check failed."
  echo "- INCONCLUSIVE means the expected behavior could not be confirmed."
  echo "- Resource snapshots alone do not establish which engine uses fewer resources."
} > "$report"

cat "$report"
record_result "report-generation" "PASS" "Report written to $report"
