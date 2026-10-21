const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const read = name =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const concurrency = Number(process.argv[2] || 100);
const totalRequests = Number(process.argv[3] || 10000);

if (!Number.isInteger(concurrency) || concurrency < 1 ||
    !Number.isInteger(totalRequests) || totalRequests < 1) {
  console.error('Usage: node tests/load-test.js <concurrency> <totalRequests>');
  process.exit(1);
}

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: concurrency,
  key: read('external-client.key'),
  cert: read('external-client.crt'),
  ca: read('ca.crt'),
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
});

function encryptPayload() {
  const payload = {
    fromAccount: 'LOAD-001',
    toAccount: 'LOAD-002',
    amount: 1,
    currency: 'INR',
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    operation: 'fund-transfer'
  };

  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);

  const encryptedKey = crypto.publicEncrypt({
    key: read('payload-public.pem'),
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, key);

  return JSON.stringify({
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  });
}

function sendRequest() {
  return new Promise(resolve => {
    const body = encryptPayload();
    const started = process.hrtime.bigint();
    let finished = false;

    const finish = result => {
      if (finished) return;
      finished = true;
      result.ms = Number(process.hrtime.bigint() - started) / 1e6;
      resolve(result);
    };

    const req = https.request({
      hostname: '127.0.0.1',
      port: 8443,
      path: '/fund-transfer',
      method: 'POST',
      agent,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      },
      timeout: 35000
    }, res => {
      res.resume();
      res.on('end', () => finish({ status: res.statusCode }));
    });

    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', err => finish({ error: err.message }));

    req.end(body);
  });
}

async function main() {
  const results = [];
  let next = 0;
  const started = process.hrtime.bigint();

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= totalRequests) return;
      results[index] = await sendRequest();
    }
  }

  console.log(`Requests: ${totalRequests}; concurrency: ${concurrency}`);
  console.log('Payload: AES-256-GCM + RSA-OAEP; gateway mTLS enabled');

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, totalRequests) },
      () => worker()
    )
  );

  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const successful = results.filter(r => r.status === 200).length;
  const failed = results.filter(r => r.error).length;
  const non200 = results.filter(r => r.status !== undefined && r.status !== 200);
  const latencies = results.map(r => r.ms).sort((a, b) => a - b);
  const percentile = p =>
    latencies[Math.min(latencies.length - 1,
      Math.ceil(p * latencies.length) - 1)] ?? 0;
  const average = latencies.length
    ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
    : 0;

  console.log('\n--- LOAD TEST RESULTS ---');
  console.log(`Elapsed seconds: ${seconds.toFixed(2)}`);
  console.log(`HTTP 200: ${successful}`);
  console.log(`Non-200 responses: ${non200.length}`);
  console.log(`Network/timeout errors: ${failed}`);
  console.log(`Requests/sec: ${(totalRequests / seconds).toFixed(2)}`);
  console.log(`Average latency: ${average.toFixed(2)} ms`);
  console.log(`p95 latency: ${percentile(0.95).toFixed(2)} ms`);
  console.log(`p99 latency: ${percentile(0.99).toFixed(2)} ms`);

  const statuses = {};
  for (const r of results) {
    const key = r.error ? 'ERROR' : String(r.status);
    statuses[key] = (statuses[key] || 0) + 1;
  }
  console.log('Status breakdown:', JSON.stringify(statuses));

  const errors = results.filter(r => r.error).slice(0, 5);
  if (errors.length) console.log('Sample errors:', errors);

  agent.destroy();

  if (successful !== totalRequests || failed > 0 || non200.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
