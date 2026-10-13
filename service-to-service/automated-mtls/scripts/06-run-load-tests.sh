#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

if [[ ! -f "$LOAD_RESULTS" ]]; then
  echo "engine,concurrency,requests,successes,failures,elapsed_seconds,requests_per_second" > "$LOAD_RESULTS"
fi

run_load() {
  local engine="$1"
  local base_url="$2"
  local concurrency="$3"
  local tmpdir start end elapsed successes failures

  tmpdir="$(mktemp -d)"
  start="$(date +%s)"

  seq 1 "$LOAD_REQUESTS" |
    xargs -P "$concurrency" -I ITEM sh -c '
      code=$(curl -sS --max-time '"$CURL_TIMEOUT"' -o /dev/null -w "%{http_code}" "'"$base_url$ROOT_ENDPOINT"'" 2>/dev/null)
      rc=$?
      if [ "$rc" -eq 0 ] && [ "$code" = "200" ]; then
        echo success >> "'"$tmpdir"'/outcomes"
      else
        echo "failure:${code:-curl-error}" >> "'"$tmpdir"'/outcomes"
      fi
    '

  end="$(date +%s)"
  elapsed=$((end - start))
  [[ "$elapsed" -gt 0 ]] || elapsed=1

  successes="$(grep -c '^success$' "$tmpdir/outcomes" 2>/dev/null || true)"
  failures=$((LOAD_REQUESTS - successes))
  rps="$(awk -v s="$successes" -v e="$elapsed" 'BEGIN {printf "%.2f", s/e}')"

  echo "\"$engine\",$concurrency,$LOAD_REQUESTS,$successes,$failures,$elapsed,$rps" >> "$LOAD_RESULTS"
  echo "$engine concurrency=$concurrency successes=$successes failures=$failures elapsed=${elapsed}s approx_rps=$rps"

  if [[ "$successes" -eq "$LOAD_REQUESTS" ]]; then
    record_result "load-$engine-c$concurrency" "PASS" "$successes/$LOAD_REQUESTS requests returned HTTP 200; approximate RPS=$rps"
  else
    record_result "load-$engine-c$concurrency" "FAIL" "$successes/$LOAD_REQUESTS requests returned HTTP 200"
  fi

  rm -rf "$tmpdir"
}

for concurrency in $LOAD_CONCURRENCIES; do
  run_load docker "$DOCKER_ROOT_URL" "$concurrency"
  run_load podman "$PODMAN_ROOT_URL" "$concurrency"
done
