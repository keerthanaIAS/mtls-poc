#!/bin/bash
set -u

# Run from the service-to-service project directory.
if [ ! -f podman-runtime/load-test.js ]; then
  echo "ERROR: Run this from the service-to-service directory."
  exit 1
fi

STAMP=$(date '+%Y%m%d-%H%M%S')
OUT="evaluation-$STAMP"
mkdir -p "$OUT"
CSV="$OUT/load-results.csv"
STATS="$OUT/resource-usage.csv"
LOG="$OUT/test.log"

# Preserve the previous baseline.
if [ -f final-load-results.csv ]; then
  cp final-load-results.csv "$OUT/previous-baseline.csv"
fi

echo "Timestamp,Engine,Container,CPU,Memory" > "$STATS"
echo "Trial,Engine,Concurrency,Total,HTTP200,Failed,DurationSec,ReqPerSec,AvgMs,P50Ms,P95Ms,P99Ms,MaxMs" > "$CSV"

exec > >(tee -a "$LOG") 2>&1

echo "========== COMPLETE mTLS EVALUATION =========="
echo "Results directory: $OUT"
echo "Start: $(date)"

# 1. Confirm both benchmark scripts are syntactically valid.
podman exec mtls-root-ms-podman node --check /app/load-test.js || exit 1
docker exec mtls-root-ms-docker node --check /app/load-test.js || exit 1
echo "PASS: Load-test scripts parse correctly."

# 2. Verify actual mTLS server-to-server calls.
for ITEM in "Podman:3101" "Docker:3201"; do
  ENGINE=${ITEM%%:*}
  PORT=${ITEM##*:}
  echo "========== $ENGINE mTLS POSITIVE TEST =========="

  BODY=$(curl -fsS --max-time 10 "http://127.0.0.1:$PORT/call-transaction") || {
    echo "FAIL: $ENGINE request failed."
    exit 1
  }
  echo "$BODY"

  echo "$BODY" | grep -q '"authenticatedClient":"root-ms"' || {
    echo "FAIL: Expected authenticated client root-ms."
    exit 1
  }
  echo "$BODY" | grep -q '"tlsVersion":"TLSv1.[23]"' || {
    echo "FAIL: Expected TLS 1.2 or 1.3."
    exit 1
  }
  echo "PASS: $ENGINE mTLS request and identity verified."
done

# 3. Test that the transaction service rejects a client without a certificate.
NEGATIVE_JS='
const https=require("https"),fs=require("fs");
let finished=false;
const req=https.get({
  hostname:"transaction-ms",port:8443,path:"/api/transaction",
  ca:fs.readFileSync("/certs/ca.crt"),rejectUnauthorized:true,timeout:5000
},res=>{
  res.resume();
  console.log("UNEXPECTED_HTTP_STATUS="+res.statusCode);
  finished=true;
  process.exitCode=2;
});
req.on("error",e=>{
  console.log("TLS_REJECTION="+e.code+":"+e.message);
  finished=true;
});
req.on("timeout",()=>req.destroy(new Error("timeout")));
'
for ENGINE in Docker Podman; do
  if [ "$ENGINE" = Docker ]; then
    CLI=docker
    ROOT=mtls-root-ms-docker
  else
    CLI=podman
    ROOT=mtls-root-ms-podman
  fi

  echo "========== $ENGINE NO-CLIENT-CERT TEST =========="
  RESULT=$("$CLI" exec "$ROOT" node -e "$NEGATIVE_JS" 2>&1 || true)
  echo "$RESULT"

  if echo "$RESULT" | grep -q 'UNEXPECTED_HTTP_STATUS'; then
    echo "FAIL: A request without a client certificate received an HTTP response."
    echo "Check the transaction service's client-certificate enforcement."
  elif echo "$RESULT" | grep -q 'TLS_REJECTION'; then
    echo "PASS: Connection without a client certificate was rejected."
  else
    echo "INCONCLUSIVE: No clear TLS rejection result; inspect logs."
  fi
done

# 4. Start resource monitoring while load tests run.
monitor_resources() {
  while true; do
    NOW=$(date '+%Y-%m-%d %H:%M:%S')
    for NAME in mtls-root-ms-docker mtls-transaction-ms-docker; do
      docker stats --no-stream --format \
        "$NOW,Docker,{{.Name}},{{.CPUPerc}},{{.MemUsage}}" "$NAME" 2>/dev/null \
        | tr -d '\r' >> "$STATS"
    done
    for NAME in mtls-root-ms-podman mtls-transaction-ms-podman; do
      podman stats --no-stream --format \
        "$NOW,Podman,{{.Name}},{{.CPUPerc}},{{.MemUsage}}" "$NAME" 2>/dev/null \
        | tr -d '\r' >> "$STATS"
    done
    sleep 2
  done
}

monitor_resources &
MONITOR_PID=$!
trap 'kill "$MONITOR_PID" 2>/dev/null || true' EXIT INT TERM

# 5. Run matched loads at increasing concurrency, alternating engine order.
run_trial() {
  ENGINE=$1
  CONCURRENCY=$2
  TRIAL=$3

  if [ "$ENGINE" = Docker ]; then
    CLI=docker
    ROOT=mtls-root-ms-docker
  else
    CLI=podman
    ROOT=mtls-root-ms-podman
  fi

  echo
  echo "========== TRIAL $TRIAL | $ENGINE | CONCURRENCY $CONCURRENCY =========="

  if ! OUTPUT=$("$CLI" exec \
      -e TOTAL=10000 -e CONCURRENCY="$CONCURRENCY" \
      "$ROOT" node /app/load-test.js); then
    echo "ERROR: Load test failed for $ENGINE at concurrency $CONCURRENCY."
    echo "$OUTPUT"
    return 1
  fi

  echo "$OUTPUT"

  field() {
    echo "$OUTPUT" | awk -F': ' -v key="$1" '$1 == key {print $2; exit}'
  }

  HTTP200=$(field "HTTP 200")
  FAILED=$(field "Failed")
  DURATION=$(field "Duration seconds")
  RPS=$(field "Requests/sec")
  AVG=$(field "Average latency ms")
  P50=$(field "P50 ms")
  P95=$(field "P95 ms")
  P99=$(field "P99 ms")
  MAX=$(field "Max ms")

  echo "$TRIAL,$ENGINE,$CONCURRENCY,10000,$HTTP200,$FAILED,$DURATION,$RPS,$AVG,$P50,$P95,$P99,$MAX" >> "$CSV"

  if [ "${HTTP200:-0}" != 10000 ] || [ "${FAILED:-10000}" != 0 ]; then
    echo "WARNING: Some requests failed. Check the output and logs."
  fi
}

# Three repetitions per engine at each load level.
TRIAL=0
for CONCURRENCY in 100 200 500; do
  for ORDER in Docker Podman Podman Docker Docker Podman; do
    TRIAL=$((TRIAL + 1))
    run_trial "$ORDER" "$CONCURRENCY" "$TRIAL" || {
      echo "ERROR: Stopping further trials after a load-test error."
      break 2
    }
  done
done

kill "$MONITOR_PID" 2>/dev/null || true
wait "$MONITOR_PID" 2>/dev/null || true
trap - EXIT INT TERM

echo
echo "========== LOAD RESULTS CSV =========="
cat "$CSV"

echo
echo "========== RESOURCE USAGE SAMPLE =========="
tail -n 20 "$STATS"

echo
echo "========== CONTAINER LOGS =========="
docker logs --tail 30 mtls-root-ms-docker 2>&1 || true
docker logs --tail 30 mtls-transaction-ms-docker 2>&1 || true
podman logs --tail 30 mtls-root-ms-podman 2>&1 || true
podman logs --tail 30 mtls-transaction-ms-podman 2>&1 || true

echo
echo "========== EVALUATION FINISHED =========="
echo "Results saved in: $OUT"
echo "Load results: $CSV"
echo "Resource samples: $STATS"
echo "Full log: $LOG"
