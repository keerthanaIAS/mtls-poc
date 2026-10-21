const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const read = (name) =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const publicKey = read('payload-public.pem');

function encryptPayload(data, path) {
  const payload = {
    ...data,
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
    operation: path.slice(1)
  };

  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);

  const encryptedKey = crypto.publicEncrypt({
    key: publicKey,
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

function callGateway(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(encryptPayload(data, path));

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
      res.on('end', () => {
        console.log(`\n${path} -> HTTP ${res.statusCode}`);
        console.log(response);
        resolve(res.statusCode);
      });
    });

    req.on('error', reject);
    req.end(body);
  });
}

async function main() {
  await callGateway('/fund-transfer', {
    fromAccount: 'DEMO-001',
    toAccount: 'DEMO-002',
    amount: 250,
    currency: 'INR'
  });

  await callGateway('/balance', {
    accountId: 'DEMO-001'
  });

  await callGateway('/refund', {
    originalReference: 'DEMO-TXN-001',
    amount: 100,
    currency: 'INR'
  });
}

main().catch(err => {
  console.error('Client failed:', err.message);
  process.exitCode = 1;
});
