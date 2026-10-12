#!/bin/bash

RESULTS="final-load-results.csv"
echo "Trial,Engine,HTTP200,Failed,DurationSec,ReqPerSec,AvgMs,P50Ms,P95Ms,P99Ms,MaxMs" > "$RESULTS"

run_trial() {
  TRIAL="$1"
  ENGINE="$2"

  if [ "$ENGINE" = "Docker" ]; then
    CLI="docker"
    CONTAINER="mtls-root-ms-docker"
  else
    CLI="podman"
    CONTAINER="mtls-root-ms-podman"
  fi

  echo
  echo "========== TRIAL $TRIAL: $ENGINE =========="

  OUTPUT=$("$CLI" exec -e TOTAL=10000 -e CONCURRENCY=100 \
    "$CONTAINER" node /app/load-test.js) || return 1

  echo "$OUTPUT"

  HTTP200=$(echo "$OUTPUT" | awk -F': ' '/HTTP 200:/ {print $2}')
  FAILED=$(echo "$OUTPUT" | awk -F': ' '/Failed:/ {print $2}')
  DURATION=$(echo "$OUTPUT" | awk -F': ' '/Duration seconds:/ {print $2}')
  RPS=$(echo "$OUTPUT" | awk -F': ' '/Requests\/sec:/ {print $2}')
  AVG=$(echo "$OUTPUT" | awk -F': ' '/Average latency ms:/ {print $2}')
  P50=$(echo "$OUTPUT" | awk -F': ' '/P50 ms:/ {print $2}')
  P95=$(echo "$OUTPUT" | awk -F': ' '/P95 ms:/ {print $2}')
  P99=$(echo "$OUTPUT" | awk -F': ' '/P99 ms:/ {print $2}')
  MAX=$(echo "$OUTPUT" | awk -F': ' '/Max ms:/ {print $2}')

  echo "$TRIAL,$ENGINE,$HTTP200,$FAILED,$DURATION,$RPS,$AVG,$P50,$P95,$P99,$MAX" >> "$RESULTS"
}

run_trial 1 Docker || exit 1
run_trial 1 Podman || exit 1
run_trial 2 Podman || exit 1
run_trial 2 Docker || exit 1
run_trial 3 Docker || exit 1
run_trial 3 Podman || exit 1

echo
echo "========== FINAL RESULTS =========="
cat "$RESULTS"
