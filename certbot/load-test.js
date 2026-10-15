const https = require('https');
const fs = require('fs');

const TOTAL = Number(process.env.TOTAL || 1000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 20);
const latencies = [];
let completed = 0;
let failed = 0;
let next = 0;

const start = Date.now();

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: CONCURRENCY,
  ca: fs.readFileSync('certs/pebble-root-ca.pem'),
  key: fs.readFileSync('certs/root-ms-client-key.pem'),
  cert: fs.readFileSync('certs/root-ms-client.pem')
});

function send() {
  if (next >= TOTAL) return;

  const id = next++;
  const requestStart = Date.now();

  const req = https.request({
    hostname: 'transaction-ms.test',
    port: 3443,
    path: '/',
    method: 'GET',
    agent,
    lookup: (_hostname, options, callback) => {
      if (options && options.all) {
        callback(null, [{ address: '127.0.0.1', family: 4 }]);
      } else {
        callback(null, '127.0.0.1', 4);
      }
    }
  }, (res) => {
    res.resume();
    res.on('end', () => {
      if (res.statusCode === 200) {
        latencies.push(Date.now() - requestStart);
      } else {
        failed++;
      }
      completed++;
      if (completed < TOTAL) send();
      else finish();
    });
  });

  req.on('error', () => {
    failed++;
    completed++;
    if (completed < TOTAL) send();
    else finish();
  });

  req.end();
}

function finish() {
  if (finish.done) return;
  finish.done = true;

  const elapsed = (Date.now() - start) / 1000;
  latencies.sort((a, b) => a - b);
  const percentile = (p) =>
    latencies.length
      ? latencies[Math.min(Math.ceil(p * latencies.length) - 1, latencies.length - 1)]
      : null;

  console.log('\n===== mTLS LOAD TEST RESULTS =====');
  console.log('Total requests:', TOTAL);
  console.log('Concurrency:', CONCURRENCY);
  console.log('Successful HTTP 200:', latencies.length);
  console.log('Failed:', failed);
  console.log('Duration (seconds):', elapsed.toFixed(2));
  console.log('Throughput (requests/sec):', (latencies.length / elapsed).toFixed(2));
  console.log('Average latency (ms):',
    latencies.length
      ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
      : 'N/A');
  console.log('p50 latency (ms):', percentile(0.50) ?? 'N/A');
  console.log('p95 latency (ms):', percentile(0.95) ?? 'N/A');
  console.log('p99 latency (ms):', percentile(0.99) ?? 'N/A');

  agent.destroy();
}

for (let i = 0; i < Math.min(CONCURRENCY, TOTAL); i++) send();
