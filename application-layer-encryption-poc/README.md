*Architectural Flow Chart*
--------------------------------
+-----------------------------------------------------------------------------------+
|                                 [ EXTERNAL CLIENT ]                               |
|                                                                                   |
|  1. Creates Payload (e.g., Fund Transfer: { account: "123", amount: 5000 })       |
|  2. Encrypts sensitive fields using INTERNAL SERVICE'S PUBLIC KEY                 |
|  3. Sends Encrypted Payload over HTTPS (mTLS with Gateway Cert)                   |
+-----------------------------------------------------------------------------------+
                                         |
                                         | HTTPS + mTLS (Port 8443)
                                         v
+-----------------------------------------------------------------------------------+
|                                  [ API GATEWAY ]                                  |
|                                                                                   |
|  4. Terminates mTLS. Validates Client Certificate (Is the Partner Bank allowed?)  |
|  5. Routes traffic.                                                               |
|  CRITICAL POINT: The gateway CANNOT read the sensitive payload.                |
|     It only sees the encrypted blob. It acts as a dumb router.                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Internal HTTPS + mTLS (Port 9443)
                                         v
+-----------------------------------------------------------------------------------+
|                              [ INTERNAL BANKING SERVICE ]                         |
|                                                                                   |
|  6. Terminates mTLS. Validates Gateway Certificate.                               |
|  7. DECRYPTS the payload using its own PRIVATE KEY.                                |
|  8. Processes the transaction (Simulated DB update).                              |
|  9. Encrypts the Response with the External Client's Public Key.                  |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Response (Encrypted Blob)
                                         v
+-----------------------------------------------------------------------------------+
|                                  [ API GATEWAY ]                                  |
| 10. Routes encrypted response back to the client.                                 |
+-----------------------------------------------------------------------------------+
                                         |
                                         | HTTPS + mTLS
                                         v
+-----------------------------------------------------------------------------------+
|                                 [ EXTERNAL CLIENT ]                               |
| 11. Decrypts response using its PRIVATE KEY. Shows "Success".                     |
+-----------------------------------------------------------------------------------+


This builds the complete sample application: external client → API gateway → internal banking service, with mTLS on both connections and separate application-layer encryption.

## Step 1 — Verify the working directory

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc

pwd
node --version
npm --version
openssl version
```

Your earlier output shows an accidental nested `application-layer-encryption-poc` directory. We won't use it; all work stays in the current directory.

## Step 2 — Generate the TLS certificates and application encryption keys

Copy and run this entire block:

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc

mkdir -p certs external-client gateway internal-service tests

# Local certificate authority
openssl genrsa -out certs/ca.key 3072

openssl req -x509 -new -nodes \
  -key certs/ca.key \
  -sha256 -days 365 \
  -out certs/ca.crt \
  -subj "/CN=Application-Layer-POC-CA"

# Gateway TLS server certificate
openssl genrsa -out certs/gateway.key 2048

openssl req -new \
  -key certs/gateway.key \
  -out certs/gateway.csr \
  -subj "/CN=localhost"

openssl x509 -req \
  -in certs/gateway.csr \
  -CA certs/ca.crt \
  -CAkey certs/ca.key \
  -CAcreateserial \
  -out certs/gateway.crt \
  -days 365 -sha256 \
  -extfile <(printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth')

# Internal service TLS server certificate
openssl genrsa -out certs/internal.key 2048

openssl req -new \
  -key certs/internal.key \
  -out certs/internal.csr \
  -subj "/CN=localhost"

openssl x509 -req \
  -in certs/internal.csr \
  -CA certs/ca.crt \
  -CAkey certs/ca.key \
  -CAcreateserial \
  -out certs/internal.crt \
  -days 365 -sha256 \
  -extfile <(printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth')

# External client certificate
openssl genrsa -out certs/external-client.key 2048

openssl req -new \
  -key certs/external-client.key \
  -out certs/external-client.csr \
  -subj "/CN=external-client"

openssl x509 -req \
  -in certs/external-client.csr \
  -CA certs/ca.crt \
  -CAkey certs/ca.key \
  -CAcreateserial \
  -out certs/external-client.crt \
  -days 365 -sha256 \
  -extfile <(printf 'extendedKeyUsage=clientAuth')

# Gateway client certificate for gateway -> internal mTLS
openssl genrsa -out certs/gateway-client.key 2048

openssl req -new \
  -key certs/gateway-client.key \
  -out certs/gateway-client.csr \
  -subj "/CN=gateway"

openssl x509 -req \
  -in certs/gateway-client.csr \
  -CA certs/ca.crt \
  -CAkey certs/ca.key \
  -CAcreateserial \
  -out certs/gateway-client.crt \
  -days 365 -sha256 \
  -extfile <(printf 'extendedKeyUsage=clientAuth')

# Separate application-layer encryption key pair
openssl genpkey -algorithm RSA \
  -pkeyopt rsa_keygen_bits:3072 \
  -out certs/payload-private.pem

openssl pkey \
  -in certs/payload-private.pem \
  -pubout \
  -out certs/payload-public.pem

# Verify certificates
openssl verify -CAfile certs/ca.crt \
  certs/gateway.crt \
  certs/internal.crt \
  certs/external-client.crt \
  certs/gateway-client.crt

ls -l certs
```

Expected certificate verification output:

```
certs/gateway.crt: OK
certs/internal.crt: OK
certs/external-client.crt: OK
certs/gateway-client.crt: OK
```

Security distinction: `ca.key` signs TLS certificates. 
`payload-private.pem` decrypts application data. 
They serve different purposes. 
Keep both private keys confidential; the payload private key must never be copied to the external client or gateway.

## Step 3 — Create the internal banking service

The internal service will own the payload decryption private key. 
It will also require a valid gateway client certificate before accepting requests.

```
cat > internal-service/server.js <<'EOF'
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const read = (name) =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const payloadPrivateKey = read('payload-private.pem');

function decryptPayload(envelope) {
  const key = crypto.privateDecrypt(
    {
      key: payloadPrivateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(envelope.encryptedKey, 'base64')
  );

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString('utf8'));
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
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

  if (req.method !== 'POST' ||
      !['/fund-transfer', '/balance', '/refund'].includes(req.url)) {
    return send(res, 404, { error: 'Route not found' });
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 100_000) req.destroy();
  });

  req.on('end', () => {
    try {
      const envelope = JSON.parse(body);
      const data = decryptPayload(envelope);

      console.log(`\nAuthenticated gateway: gateway`);
      console.log(`Operation: ${req.url}`);
      console.log('Decrypted sample payload:', data);

      // Simulated responses only. No real transactions are executed.
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
        if (!(Number(data.amount) > 0)) {
          return send(res, 400, { error: 'Invalid amount' });
        }

        return send(res, 200, {
          success: true,
          operation: 'fund-transfer',
          reference: crypto.randomUUID(),
          simulated: true
        });
      }

      if (req.url === '/refund') {
        if (!(Number(data.amount) > 0)) {
          return send(res, 400, { error: 'Invalid amount' });
        }

        return send(res, 200, {
          success: true,
          operation: 'refund',
          reference: crypto.randomUUID(),
          simulated: true
        });
      }
    } catch (err) {
      console.error('Request rejected:', err.message);
      return send(res, 400, {
        error: 'Invalid or tampered encrypted payload'
      });
    }
  });
});

server.listen(9443, '127.0.0.1', () => {
  console.log('Internal banking service listening on https://127.0.0.1:9443');
  console.log('Requires gateway mTLS certificate.');
});
EOF
```

## Step 4 — Create the API gateway

The gateway authenticates the external client, then establishes a separate mTLS connection to the internal service. 
It forwards the encrypted request body without decrypting the banking payload.

```
cat > gateway/server.js <<'EOF'
const https = require('https');
const fs = require('fs');

const read = (name) =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = https.createServer({
  key: read('gateway.key'),
  cert: read('gateway.crt'),
  ca: read('ca.crt'),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
}, (req, res) => {
  if (req.socket.getPeerCertificate().subject?.CN !== 'external-client') {
    return send(res, 403, { error: 'External client identity required' });
  }

  if (req.method !== 'POST' ||
      !['/fund-transfer', '/balance', '/refund'].includes(req.url)) {
    return send(res, 404, { error: 'Route not found' });
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 100_000) req.destroy();
  });

  req.on('end', () => {
    // The gateway routes the envelope unchanged.
    const upstream = https.request({
      hostname: '127.0.0.1',
      port: 9443,
      path: req.url,
      method: 'POST',
      key: read('gateway-client.key'),
      cert: read('gateway-client.crt'),
      ca: read('ca.crt'),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    }, upstreamRes => {
      let response = '';
      upstreamRes.on('data', chunk => response += chunk);
      upstreamRes.on('end', () => {
        res.writeHead(upstreamRes.statusCode || 502, {
          'content-type': 'application/json'
        });
        res.end(response);
      });
    });

    upstream.on('error', err => {
      console.error('Internal service connection failed:', err.message);
      send(res, 502, { error: 'Internal service unavailable' });
    });

    upstream.end(body);
  });
});

server.listen(8443, '127.0.0.1', () => {
  console.log('API gateway listening on https://127.0.0.1:8443');
  console.log('Requires external-client mTLS certificate.');
});
EOF
```

## Step 5 — Create the external client

The client encrypts the complete sample payload using AES-256-GCM, then encrypts the AES key using the internal service's public key with RSA-OAEP. Only the internal service has the corresponding private key.

```
cat > external-client/client.js <<'EOF'
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const read = (name) =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const publicKey = read('payload-public.pem');

function encryptPayload(data) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
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
    const body = JSON.stringify(encryptPayload(data));

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
EOF
```

## Step 6 — Add the negative security test and protect private keys

Create a tampering test. 
It uses a valid external client certificate but deliberately changes the encrypted payload. 
The internal service should reject it.

```
cat > tests/tamper.js <<'EOF'
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
EOF
```

Create `.gitignore` so private keys and certificates aren't accidentally committed:

```
cat > .gitignore <<'EOF'
certs/*.key
certs/*.pem
certs/*.csr
certs/*.srl
certs/*.crt
!certs/payload-public.pem
EOF
```

The payload public key is safe to distribute; the private key is not. For this local POC, keep all generated material in `certs/`.

## Step 7 — Start the three components

Open three terminal tabs. Run each command from the POC directory.

Terminal 1 — Internal service

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc
node internal-service/server.js
```

Expected: listening on port `9443`.

Terminal 2 — API gateway

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc
node gateway/server.js
```

Expected: listening on port `8443`.

Terminal 3 — External client

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc
node external-client/client.js
```

Expected results from the external client:

- `/fund-transfer` → HTTP 200
- `/balance` → HTTP 200
- `/refund` → HTTP 200

All responses are simulated. The internal service logs decrypted sample payloads; the gateway should only handle the encrypted envelope.

## Step 8 — Run the security tests

After the three servers are running, use a fourth terminal.

Test A — Tampered application payload

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc
node tests/tamper.js
```

Expected: HTTP `400`, with `Invalid or tampered encrypted payload`.

Test B — External request without a client certificate

```
curl -v --cacert certs/ca.crt \
  -H 'Content-Type: application/json' \
  -d '{}' \
  https://127.0.0.1:8443/balance
```

Expected: TLS handshake failure because the gateway requires an external client certificate. The exact curl error can vary by Node.js and OpenSSL version.

Test C — Verify the internal service requires mTLS

```
curl -v --cacert certs/ca.crt \
  -H 'Content-Type: application/json' \
  -d '{}' \
  https://127.0.0.1:9443/balance
```

Expected: TLS handshake failure because the internal service requires the gateway's client certificate.

Test D — Verify the public key and private key are different files

```
openssl pkey -pubin -in certs/payload-public.pem -pubout
openssl pkey -in certs/payload-private.pem -pubout
```

The two public-key outputs should match. This verifies that the public key corresponds to the private key without exposing the private key itself.

## Step 9 — Final verification

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc

find external-client gateway internal-service tests certs \
  -maxdepth 2 -type f | sort

git status --short
```

The intended security boundaries are:

| Layer                                      | Authentication or protection                          |
| ------------------------------------------ | ----------------------------------------------------- |
| External client → gateway                  | mTLS                                                  |
| Gateway → internal service                 | Separate mTLS connection                              |
| External client → internal service payload | AES-256-GCM encryption; AES key wrapped with RSA-OAEP |
| Gateway                                    | Routes encrypted payload; does not decrypt it         |
| Internal service                           | Holds the payload private key and decrypts the data   |

This is a local learning POC, not production-ready banking security. Before production, add authorization, request signing or equivalent sender-integrity controls, replay protection, strict schema validation, rate limiting, secret management, audit controls, and real banking transaction safeguards.

*After Above run command completed next steps*:
-----------------------------------------------

The tampered-payload test passed, and the application encryption key pair matches. Your two curl tests also show the server requested a client certificate, but they did not complete successfully without one. That is consistent with mTLS rejection; let's verify it explicitly and run the positive tests.

One detail: the `curl` commands in your pasted output appear to have been converted into Markdown links. Use the plain URLs below.

## Step 1 — Run the positive end-to-end tests

Make sure both servers are running in their respective terminal tabs:

- Terminal 1: `node internal-service/server.js`
- Terminal 2: `node gateway/server.js`

In a third terminal:

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc
node external-client/client.js
```

Expected: all three operations return HTTP 200. The internal service should log the decrypted sample payloads.

## Step 2 — Confirm the gateway rejects a client without a certificate

Run this as one command:

```
curl -v --cacert certs/ca.crt -H 'Content-Type: application/json' -d '{}' https://127.0.0.1:8443/balance
```

Your previous output showed a TLS failure while reading the response. To confirm that the cause is mTLS, inspect the gateway terminal for a TLS handshake error and compare it with the successful request in Step 1.

## Step 3 — Confirm the internal service rejects a client without a certificate

```
curl -v --cacert certs/ca.crt -H 'Content-Type: application/json' -d '{}' https://127.0.0.1:9443/balance
```

Again, expect the TLS handshake to fail because this endpoint requires the gateway's client certificate.

## Step 4 — Verify the gateway cannot decrypt the payload

The gateway code should contain no reference to `payload-private.pem` or `privateDecrypt`.

```
grep -nE 'payload-private|privateDecrypt|decryptPayload' gateway/server.js
```

Expected: no output. The internal service should be the only component that decrypts the application payload.

## Step 5 — Record the current results

| Test                           | Current result                                             |
| ------------------------------ | ---------------------------------------------------------- |
| Tampered ciphertext            | PASS — HTTP 400                                            |
| Payload key-pair match         | PASS                                                       |
| External mTLS rejection        | Consistent with TLS failure; confirm against positive test |
| Internal mTLS rejection        | Consistent with TLS failure; confirm against positive test |
| Fund transfer, balance, refund | Pending positive end-to-end run                            |

Important correction before calling the POC complete: your current implementation checks the certificate's subject CN after the TLS handshake. That's useful for this demonstration, but production systems need robust identity validation and authorization; a trusted certificate alone does not authorize a banking operation. Also, `git status` reports `?? ./`, meaning this directory is not yet tracked as a Git repository or is inside an untracked parent. Don't commit private keys.

*After Above run command completed next steps*:
-----------------------------------------------

Your positive end-to-end tests pass for all three banking operations, and the gateway contains no application-payload decryption code. The next step is to prove both mTLS connections reject unauthenticated clients and verify what the gateway can actually see.

One correction: your curl errors are consistent with certificate rejection, but the TLS trace alone does not prove the exact server-side reason. Let's verify with explicit server logs.

## 1. Confirm mTLS rejection from server logs

In the gateway terminal and internal-service terminal, inspect the errors that appear when you run the certificate-less curl commands. Node.js should report a TLS error such as a missing client certificate.

Your current results:

| Test                                   | Result                                         |
| -------------------------------------- | ---------------------------------------------- |
| Fund transfer                          | PASS — HTTP 200                                |
| Balance inquiry                        | PASS — HTTP 200                                |
| Refund                                 | PASS — HTTP 200                                |
| Tampered ciphertext                    | PASS — HTTP 400                                |
| Gateway has no payload decryption code | PASS                                           |
| Certificate-less client rejected       | Consistent with rejection; confirm server logs |

## 2. Prove application-layer encryption is independent of TLS

Run this command to inspect the gateway's request-handling code:

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc

sed -n '1,220p' gateway/server.js
```

The gateway should forward the encrypted JSON envelope without calling `privateDecrypt` or reading `payload-private.pem`.

Now inspect the internal service:

```
grep -nE 'payload-private|privateDecrypt|decryptPayload' internal-service/server.js
```

The internal service should contain the decryption logic and load the private key.

## 3. Add an explicit negative test for an untrusted client certificate

Your current certificate-less curl tests use no client certificate. A second useful test is a client presenting a certificate signed by an untrusted CA. The gateway should reject the TLS handshake before processing the HTTP request.

First, create a separate test CA and client certificate:

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/bad-client-ca.key \
  -out certs/bad-client-ca.crt \
  -days 2 \
  -subj "/CN=UNTRUSTED-TEST-CA"

openssl req -newkey rsa:2048 -nodes \
  -keyout certs/bad-client.key \
  -out certs/bad-client.csr \
  -subj "/CN=external-client"

openssl x509 -req \
  -in certs/bad-client.csr \
  -CA certs/bad-client-ca.crt \
  -CAkey certs/bad-client-ca.key \
  -CAcreateserial \
  -out certs/bad-client.crt \
  -days 2 -sha256
```

Test against the gateway:

```
curl -v \
  --cacert certs/ca.crt \
  --cert certs/bad-client.crt \
  --key certs/bad-client.key \
  -H 'Content-Type: application/json' \
  -d '{}' \
  https://127.0.0.1:8443/balance
```

Expected: TLS handshake failure because the gateway trusts `certs/ca.crt`, not the separate test CA.

*After Above run command completed next steps*:
----------------------------------------------

The untrusted-client test was rejected: the connection reset after the client presented a certificate signed by `UNTRUSTED-TEST-CA`. That is consistent with the gateway rejecting the certificate during mTLS, although the server log is needed to confirm the exact TLS error.

Your current POC has these confirmed results:

| Check                                        | Result                                           |
| -------------------------------------------- | ------------------------------------------------ |
| Fund transfer, balance, refund               | PASS — all HTTP 200                              |
| Tampered ciphertext                          | PASS — HTTP 400                                  |
| Gateway does not decrypt payload             | PASS — no decryption code found                  |
| Internal service owns payload decryption key | PASS — code confirmed                            |
| Untrusted client certificate                 | Rejected; inspect gateway logs to confirm reason |

## Next: verify the rejection and the valid-client path

### 1. Inspect the gateway terminal

Look for a TLS error indicating an unknown CA, an unauthorized client certificate, or a failed certificate verification.

### 2. Confirm a trusted client still succeeds

```
cd /Users/keerthana/Desktop/mtls-poc/application-layer-encryption-poc
node external-client/client.js
```

Expected: all three operations return HTTP 200 again.

### 3. Confirm the internal service rejects an untrusted gateway

The internal service trusts `certs/ca.crt`. 
To test the opposite connection, use the untrusted client certificate as a client certificate against port `9443`:

```
curl -v \
  --cacert certs/ca.crt \
  --cert certs/bad-client.crt \
  --key certs/bad-client.key \
  -H 'Content-Type: application/json' \
  -d '{}' \
  https://127.0.0.1:9443/balance
```

Expected: TLS rejection before the internal service processes the HTTP request.

*After Above run command completed next stepst*:
-----------------------------------------------
PASS — the internal service rejected the untrusted client certificate.

Your output shows the TLS connection was established initially, but after the request was sent, the server reset the connection. This is consistent with the internal service rejecting the certificate signed by UNTRUSTED-TEST-CA, rather than your trusted Application-Layer-POC-CA.

The exact TLS rejection reason isn't shown in this curl output, but the connection reset is consistent with the expected negative test.

Current POC test results:-
------------------------------------------------------------------------
Test	                                                          Result
------------------------------------------------------------------------
Fund transfer through gateway	                                   PASS
Balance check through gateway	                                   PASS
Refund through gateway	                                         PASS
Tampered encrypted payload rejected	                             PASS
Gateway does not decrypt payload	                               PASS
Untrusted client certificate rejected by gateway	               Consistent with PASS
Untrusted client certificate rejected by internal service	       Consistent with PASS

What we have demonstrated:-
  1. External TLS/mTLS: The external client connects securely to the gateway using its client certificate.
  2. Internal TLS/mTLS: The gateway connects to the internal service using its own client certificate.
  3. Application-layer encryption: The external client encrypts the payload, and only the internal service has the private key needed to decrypt it.
  4. Tamper detection: Changing encrypted data causes decryption to fail.
  5. Certificate trust enforcement: Clients signed by an untrusted CA cannot successfully use either service.

*Upto Now What We Implemented*:
--------------------------------
      We implemented mTLS on both the external-client-to-gateway and gateway-to-internal-service connections, plus application-layer payload encryption so the gateway forwards ciphertext and the internal service detects payload tampering during authenticated decryption.

  *  The external client encrypts the payload.
  *  The gateway forwards the encrypted payload without decrypting it.
  *  The internal service decrypts the payload.
  *  If someone changes the ciphertext, AES-GCM authentication fails when the internal service decrypts it.

  - So the encryption does not itself prevent someone from attempting to change the payload; AES-GCM detects tampering when the internal service verifies and decrypts it. Our tampering test returned HTTP 400, as expected.

| File                  | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `ca.key`              | CA private key                                            |
| `ca.crt`              | CA certificate                                            |
| `gateway.key`         | Gateway private key                                       |
| `gateway.crt`         | Gateway server certificate                                |
| `gateway.csr`         | Gateway certificate request                               |
| `internal.key`        | Internal service private key                              |
| `internal.crt`        | Internal service server certificate                       |
| `internal.csr`        | Internal service certificate request                      |
| `external-client.key` | External client private key                               |
| `external-client.crt` | External client certificate                               |
| `external-client.csr` | External client certificate request                       |
| `gateway-client.key`  | Gateway's client private key for mTLS to internal service |
| `gateway-client.crt`  | Gateway's client certificate for mTLS to internal service |
| `gateway-client.csr`  | Gateway client certificate request                        |
| `payload-public.pem`  | Application-encryption public key                         |
| `payload-private.pem` | Application-encryption private key                        |
| `bad-client-ca.key`   | Untrusted test CA private key                             |
| `bad-client-ca.crt`   | Untrusted test CA certificate                             |
| `bad-client.key`      | Untrusted test client's private key                       |
| `bad-client.crt`      | Untrusted test client's certificate                       |
| `bad-client.csr`      | Untrusted test client's certificate request               |

For application-layer payload encryption and decryption, we use 2 files:
-----------------------------------------------------------------------
1. `payload-public.pem` — Encryption: the external client uses this public key to encrypt (wrap) the AES key with RSA-OAEP.
2. `payload-private.pem` — Decryption: the internal service uses this private key to decrypt (unwrap) the AES key.

The actual payload is encrypted and decrypted using AES-256-GCM with that AES key.

The gateway does not need `payload-private.pem`.