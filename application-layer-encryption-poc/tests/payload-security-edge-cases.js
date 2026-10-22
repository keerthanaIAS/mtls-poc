const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');

const read = name =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const failures = [];
let passed = 0;

function validPayload(overrides = {}) {
  return {
    fromAccount: 'DEMO-001',
    toAccount: 'DEMO-002',
    amount: 100,
    currency: 'INR',
    operation: 'fund-transfer',
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    ...overrides
  };
}

function createEnvelope(payload) {
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

  return {
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

function send(body, path = '/fund-transfer') {
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

    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.on('error', reject);
    req.end(body);
  });
}

async function check(name, expectedStatus, bodyFactory) {
  try {
    const body = bodyFactory();
    const result = await send(body);

    assert.strictEqual(
      result.status,
      expectedStatus,
      `Expected HTTP ${expectedStatus}, got HTTP ${result.status}. ` +
      `Response: ${result.body}`
    );

    passed++;
    console.log(`PASS: ${name} -> HTTP ${result.status}`);
  } catch (err) {
    failures.push({ name, message: err.message });
    console.error(`FAIL: ${name} -> ${err.message}`);
  }
}

function encryptedBody(payload, mutateEnvelope) {
  const envelope = createEnvelope(payload);
  if (mutateEnvelope) mutateEnvelope(envelope);
  return JSON.stringify(envelope);
}

async function main() {
  console.log('Application-layer encryption edge-case tests');
  console.log('Target: https://127.0.0.1:8443');
  console.log('Existing test files will not be run.\n');

  // 1. Change only the authentication tag.
  await check('Authentication-tag tampering', 400, () =>
    encryptedBody(validPayload(), envelope => {
      const tag = Buffer.from(envelope.authTag, 'base64');
      tag[0] ^= 1;
      envelope.authTag = tag.toString('base64');
    })
  );

  // 2. Correct Base64 and plausible RSA ciphertext length,
  // but bytes that should not decrypt with the payload private key.
  await check('Invalid RSA-OAEP wrapped key', 400, () =>
    encryptedBody(validPayload(), envelope => {
      envelope.encryptedKey = crypto.randomBytes(256).toString('base64');
    })
  );

  // 3. Remove each required envelope field separately.
  for (const field of [
    'encryptedKey',
    'iv',
    'ciphertext',
    'authTag'
  ]) {
    await check(`Missing envelope field: ${field}`, 400, () =>
      encryptedBody(validPayload(), envelope => {
        delete envelope[field];
      })
    );
  }

  // 4. Invalid Base64 in each envelope field.
  for (const field of [
    'encryptedKey',
    'iv',
    'ciphertext',
    'authTag'
  ]) {
    await check(`Invalid Base64: ${field}`, 400, () =>
      encryptedBody(validPayload(), envelope => {
        envelope[field] = '!!!!';
      })
    );
  }

  // 5. Valid Base64, but invalid IV/tag dimensions.
  await check('IV is not 12 bytes', 400, () =>
    encryptedBody(validPayload(), envelope => {
      envelope.iv = crypto.randomBytes(8).toString('base64');
    })
  );

  await check('Authentication tag is not 16 bytes', 400, () =>
    encryptedBody(validPayload(), envelope => {
      envelope.authTag = crypto.randomBytes(12).toString('base64');
    })
  );

  // 6. Invalid amount types and values.
  const invalidAmounts = [
    ['String amount', '100'],
    ['Null amount', null],
    ['Missing amount', undefined]
  ];

  for (const [name, amount] of invalidAmounts) {
    await check(name, 400, () => {
      const payload = validPayload();

      if (name === 'Missing amount') {
        delete payload.amount;
      } else {
        payload.amount = amount;
      }

      return encryptedBody(payload);
    });
  }

  // 7. Account-field validation.
  // These tests intentionally expect rejection. The current implementation
  // does not validate fromAccount/toAccount, so failures expose that gap.
  const invalidAccounts = [
    ['Missing fromAccount', payload => delete payload.fromAccount],
    ['Missing toAccount', payload => delete payload.toAccount],
    ['Null fromAccount', payload => { payload.fromAccount = null; }],
    ['Numeric fromAccount', payload => { payload.fromAccount = 123; }],
    ['Null toAccount', payload => { payload.toAccount = null; }],
    ['Numeric toAccount', payload => { payload.toAccount = 456; }]
  ];

  for (const [name, mutate] of invalidAccounts) {
    await check(name, 400, () => {
      const payload = validPayload();
      mutate(payload);
      return encryptedBody(payload);
    });
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failures.length}`);

  if (failures.length) {
    console.log('\nFailures to investigate:');
    for (const failure of failures) {
      console.log(`- ${failure.name}: ${failure.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log('All selected edge-case tests passed.');
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exitCode = 1;
});
