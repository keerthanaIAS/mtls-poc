const http = require("http");
const total = Number(process.env.TOTAL || 5000);
const concurrency = Number(process.env.CONCURRENCY || 50);
let started = 0, completed = 0, success = 0, failed = 0;
const latencies = [];
const startTime = process.hrtime.bigint();

function request() {
  if (started >= total) return;
  started++;
  const t0 = process.hrtime.bigint();
  let counted = false;

  function finish(ok, ms) {
    if (counted) return;
    counted = true;
    if (ms !== null) latencies.push(ms);
    if (ok) success++;
    else failed++;
    completed++;
    if (completed === total) report();
    else request();
  }

  const req = http.get("http://127.0.0.1:3001/call-transaction", res => {
    res.resume();
    res.on("end", () => finish(
      res.statusCode === 200,
      Number(process.hrtime.bigint() - t0) / 1e6
    ));
  });

  req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  req.on("error", () => finish(false, null));
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1] ?? 0;
}

function report() {
  const seconds = Number(process.hrtime.bigint() - startTime) / 1e9;
  console.log("Total requests:", total);
  console.log("Concurrency:", concurrency);
  console.log("HTTP 200:", success);
  console.log("Failed:", failed);
  console.log("Duration seconds:", seconds.toFixed(2));
  console.log("Requests/sec:", (total / seconds).toFixed(2));
  console.log("Average latency ms:", (latencies.reduce((a,b)=>a+b,0) / (latencies.length || 1)).toFixed(2));
  console.log("P50 ms:", percentile(latencies, 0.50).toFixed(2));
  console.log("P95 ms:", percentile(latencies, 0.95).toFixed(2));
  console.log("P99 ms:", percentile(latencies, 0.99).toFixed(2));
  console.log("Max ms:", Math.max(0, ...latencies).toFixed(2));
}

for (let i = 0; i < concurrency; i++) request();
