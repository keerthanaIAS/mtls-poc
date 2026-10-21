const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const read = name =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

const ciphertext = Buffer.concat([
  cipher.update(JSON.stringify({ amount: 100 }), 'utf8'),
  cipher.final()
]);

const envelope = {
  encryptedKey: crypto.publicEncrypt({
    key: read('payload-public.pem'),
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, key).toString('base64'),
  iv: iv.toString('base64'),
  ciphertext: ciphertext.toString('base64'),
  authTag: cipher.getAuthTag().toString('base64')
};

// Change ciphertext after encryption without updating the authentication tag.
const bytes = Buffer.from(envelope.ciphertext, 'base64');
bytes[0] ^= 1;
envelope.ciphertext = bytes.toString('base64');

const body = JSON.stringify(envelope);

const req = https.request({
  hostname: '127.0.0.1',
  port: 8443,
  path: '/fund-transfer',
  method: 'POST',
  key: read('external-client.key'),
  cert: read('external-client.crt'),
  ca: read('ca.crt'),
  rejectUnauthorized: true,
  headers: {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body)
  }
}, res => {
  let response = '';
  res.on('data', chunk => response += chunk);
  res.on('end', () => {
    console.log('Tampering test HTTP status:', res.statusCode);
    console.log('Response:', response);
    if (res.statusCode !== 400) process.exitCode = 1;
  });
});

req.on('error', err => {
  console.error(err.message);
  process.exitCode = 1;
});
req.end(body);
