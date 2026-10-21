const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');

const read = name =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

function encryptPayload(data, operation) {
  const payload = {
    ...data,
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    operation
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

function send(path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '127.0.0.1',
      port: 8443,
      path,
      method: 'POST',
      key: read('external-client.key'),
      cert: read('external-client.crt'),
      ca: read('ca.crt'),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    }, res => {
      let response = '';
      res.on('data', chunk => response += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        body: response
      }));
    });

    req.on('error', reject);
    req.end(body);
  });
}

async function expectStatus(name, path, body, expected) {
  const result = await send(path, body);

  assert.strictEqual(
    result.status,
    expected,
    `${name}: expected HTTP ${expected}, got HTTP ${result.status}. Body: ${result.body}`
  );

  console.log(`PASS: ${name} -> HTTP ${result.status}`);
}

async function main() {
  await expectStatus(
    'Invalid route',
    '/not-a-route',
    '{}',
    404
  );

  await expectStatus(
    'Malformed encrypted envelope',
    '/balance',
    '{}',
    400
  );

  await expectStatus(
    'Invalid negative amount',
    '/fund-transfer',
    encryptPayload({
      fromAccount: 'DEMO-001',
      toAccount: 'DEMO-002',
      amount: -10
    }, 'fund-transfer'),
    400
  );

  const replayBody = encryptPayload({
    fromAccount: 'DEMO-001',
    toAccount: 'DEMO-002',
    amount: 50,
    currency: 'INR'
  }, 'fund-transfer');

  await expectStatus(
    'First request with unique ID',
    '/fund-transfer',
    replayBody,
    200
  );

  await expectStatus(
    'Replay of the same encrypted request',
    '/fund-transfer',
    replayBody,
    409
  );

  console.log('\nAll security-suite tests passed.');
}

main().catch(err => {
  console.error('\nSECURITY SUITE FAILED:', err.message);
  process.exitCode = 1;
});
