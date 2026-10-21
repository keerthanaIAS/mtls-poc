const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const read = (name) =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const payloadPrivateKey = read('payload-private.pem');
const WINDOW_MS = 5 * 60 * 1000;
const processedRequests = new Map();

const routes = {
  '/fund-transfer': 'fund-transfer',
  '/balance': 'balance',
  '/refund': 'refund'
};

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function isBase64(value) {
  if (typeof value !== 'string' || !value || value.length % 4 !== 0) {
    return false;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return false;
  }

  return Buffer.from(value, 'base64').toString('base64') === value;
}

function decryptPayload(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Invalid envelope');
  }

  const { encryptedKey, iv, ciphertext, authTag } = envelope;

  if (
    !isBase64(encryptedKey) ||
    !isBase64(iv) ||
    !isBase64(ciphertext) ||
    !isBase64(authTag)
  ) {
    throw new Error('Invalid envelope encoding');
  }

  const encryptedKeyBuffer = Buffer.from(encryptedKey, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');

  if (
    encryptedKeyBuffer.length < 256 ||
    encryptedKeyBuffer.length > 1024 ||
    ivBuffer.length !== 12 ||
    ciphertextBuffer.length === 0 ||
    authTagBuffer.length !== 16
  ) {
    throw new Error('Invalid envelope dimensions');
  }

  const key = crypto.privateDecrypt({
    key: payloadPrivateKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, encryptedKeyBuffer);

  if (key.length !== 32) {
    throw new Error('Invalid AES key');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  const plaintext = Buffer.concat([
    decipher.update(ciphertextBuffer),
    decipher.final()
  ]);

  const data = JSON.parse(plaintext.toString('utf8'));

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid payload');
  }

  return data;
}

function validateRequest(data, path) {
  const expectedOperation = routes[path];

  if (!expectedOperation || data.operation !== expectedOperation) {
    return 'Payload operation does not match route';
  }

  if (
    typeof data.requestId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)
  ) {
    return 'Invalid request ID';
  }

  if (
    !Number.isSafeInteger(data.timestamp) ||
    Math.abs(Date.now() - data.timestamp) > WINDOW_MS
  ) {
    return 'Request timestamp is invalid or expired';
  }

  if (path === '/balance') {
    if (typeof data.accountId !== 'string' || !data.accountId.trim()) {
      return 'Invalid account ID';
    }
  }

  if (path === '/fund-transfer' || path === '/refund') {
    if (typeof data.amount !== 'number' ||
        !Number.isFinite(data.amount) ||
        data.amount <= 0) {
      return 'Invalid amount';
    }
  }

  return null;
}

function removeExpiredRequests() {
  const now = Date.now();

  for (const [id, expiresAt] of processedRequests) {
    if (expiresAt <= now) processedRequests.delete(id);
  }
}

const server = https.createServer({
  key: read('internal.key'),
  cert: read('internal.crt'),
  ca: read('ca.crt'),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
}, (req, res) => {
  if (req.socket.getPeerCertificate().subject?.CN !== 'gateway') {
    return send(res, 403, { error: 'Gateway identity required' });
  }

  if (req.method !== 'POST' || !routes[req.url]) {
    return send(res, 404, { error: 'Route not found' });
  }

  let body = '';
  let tooLarge = false;

  req.on('data', chunk => {
    if (tooLarge) return;

    body += chunk.toString('utf8');

    if (Buffer.byteLength(body, 'utf8') > 100_000) {
      tooLarge = true;
      send(res, 413, { error: 'Request too large' });
      req.destroy();
    }
  });

  req.on('end', () => {
    if (tooLarge || res.writableEnded) return;

    let data;

    try {
      const envelope = JSON.parse(body);
      data = decryptPayload(envelope);
    } catch {
      return send(res, 400, {
        error: 'Invalid or tampered encrypted payload'
      });
    }

    const validationError = validateRequest(data, req.url);

    if (validationError) {
      return send(res, 400, { error: validationError });
    }

    removeExpiredRequests();

    if (processedRequests.has(data.requestId)) {
      return send(res, 409, { error: 'Duplicate request detected' });
    }

    // Record before processing so a repeated request cannot execute twice
    // within this running process.
    processedRequests.set(data.requestId, Date.now() + WINDOW_MS);

    // Demo responses only; no real financial operations are performed.
    if (req.url === '/balance') {
      return send(res, 200, {
        success: true,
        operation: 'balance',
        availableBalance: 5000,
        currency: 'INR',
        simulated: true
      });
    }

    if (req.url === '/fund-transfer') {
      return send(res, 200, {
        success: true,
        operation: 'fund-transfer',
        reference: crypto.randomUUID(),
        simulated: true
      });
    }

    if (req.url === '/refund') {
      return send(res, 200, {
        success: true,
        operation: 'refund',
        reference: crypto.randomUUID(),
        simulated: true
      });
    }
  });
});

server.listen(9443, '0.0.0.0', () => {
  console.log('Internal banking service listening on https://127.0.0.1:9443');
  console.log('Requires gateway mTLS certificate.');
});
