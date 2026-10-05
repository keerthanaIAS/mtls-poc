We Build:
                 CA
              /     \
             /       \
      server.crt    client.crt
          |             |
          ▼             ▼
   mtls-server    mtls-client
       SERVER          CLIENT
          ◄──── mTLS ────►

1. Create our private CA:
openssl genrsa -out certs/ca.key 4096

openssl req -x509 -new -nodes \
  -key certs/ca.key \
  -sha256 \
  -days 365 \
  -out certs/ca.crt \
  -subj "/CN=MTLS-POC-CA"

Check:
        openssl x509 -in certs/ca.crt -noout -subject -issuer

keerthana@Mac-677 mtls-poc % openssl genrsa -out certs/ca.key 4096
Generating RSA private key, 4096 bit long modulus
...............................................................................................................++++
.................................................++++
e is 65537 (0x10001)
keerthana@Mac-677 mtls-poc % openssl req -x509 -new -nodes \
  -key certs/ca.key \
  -sha256 \
  -days 365 \
  -out certs/ca.crt \
  -subj "/CN=MTLS-POC-CA"
keerthana@Mac-677 mtls-poc % openssl x509 -in certs/ca.crt -noout -subject -issuer
subject= /CN=MTLS-POC-CA
issuer= /CN=MTLS-POC-CA                                                                                         -->*CA is self-signed.*
keerthana@Mac-677 mtls-poc % 

**What we just created**:
ca.key
   |
   └── private CA signing key

ca.crt
   |
   └── certificate that clients/services will trust

2. Create the server private key:
         openssl genrsa -out certs/server.key 2048

3. Create the server certificate request:
        openssl req -new \
         -key certs/server.key \
         -out certs/server.csr \
         -subj "/CN=mtls-server"

4. Add the server identity/SAN:
        Create the extension file:
        -------------------------
        cat > certs/server.ext <<'EOF'
        basicConstraints=CA:FALSE
        keyUsage=digitalSignature,keyEncipherment
        extendedKeyUsage=serverAuth             -->*This certificate is allowed to identify a server.*
        subjectAltName=DNS:mtls-server,DNS:localhost
        EOF

The important part is:
extendedKeyUsage=serverAuth --> This certificate is allowed to identify a server.
subjectAltName=DNS:mtls-server --> means the certificate is valid when the client connects to: https://mtls-server

5. Have our CA sign it:
        openssl x509 -req \
          -in certs/server.csr \
          -CA certs/ca.crt \
          -CAkey certs/ca.key \
          -CAcreateserial \
          -out certs/server.crt \
          -days 365 \
          -sha256 \
          -extfile certs/server.ext

Then verify it: openssl verify -CAfile certs/ca.crt certs/server.crt
And inspect: openssl x509 -in certs/server.crt -noout -subject -issuer -ext extendedKeyUsage -ext subjectAltName

keerthana@Mac-677 mtls-poc % openssl genrsa -out certs/server.key 2048
Generating RSA private key, 2048 bit long modulus
..................................................+++++
............................................................................................+++++
e is 65537 (0x10001)
keerthana@Mac-677 mtls-poc % openssl req -new \
  -key certs/server.key \
  -out certs/server.csr \
  -subj "/CN=mtls-server"
keerthana@Mac-677 mtls-poc % cat > certs/server.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:mtls-server,DNS:localhost
EOF
keerthana@Mac-677 mtls-poc % openssl x509 -req \
  -in certs/server.csr \
  -CA certs/ca.crt \
  -CAkey certs/ca.key \
  -CAcreateserial \
  -out certs/server.crt \
  -days 365 \
  -sha256 \
  -extfile certs/server.ext
Signature ok
subject=/CN=mtls-server
Getting CA Private Key
keerthana@Mac-677 mtls-poc % openssl verify -CAfile certs/ca.crt certs/server.crt
certs/server.crt: OK
keerthana@Mac-677 mtls-poc % openssl x509 -in certs/server.crt -noout -subject -issuer -ext extendedKeyUsage -ext subjectAltName
unknown option -ext
usage: x509 [-C] [-addreject arg] [-addtrust arg] [-alias] [-CA file]
    [-CAcreateserial] [-CAform der | pem] [-CAkey file]
    [-CAkeyform der | pem] [-CAserial file] [-certopt option]
    [-checkend arg] [-clrext] [-clrreject] [-clrtrust] [-dates]
    [-days arg] [-email] [-enddate] [-extensions section]
    [-extfile file] [-fingerprint] [-hash] [-in file]
    [-inform der | net | pem] [-issuer] [-issuer_hash]
    [-issuer_hash_old] [-keyform der | pem] [-md5 | -sha1]
    [-modulus] [-nameopt option] [-next_serial] [-noout]
    [-ocsp_uri] [-ocspid] [-out file]
    [-outform der | net | pem] [-passin arg] [-pubkey]
    [-purpose] [-req] [-serial] [-set_serial n] [-setalias arg]
    [-signkey file] [-sigopt nm:v] [-startdate] [-subject]
    [-subject_hash] [-subject_hash_old] [-text] [-trustout]
    [-x509toreq]

 -C                 Convert the certificate into C code
 -addreject arg     Reject certificate for a given purpose
 -addtrust arg      Trust certificate for a given purpose
 -alias             Output certificate alias
 -CA file           CA certificate in PEM format unless -CAform is specified
 -CAcreateserial    Create serial number file if it does not exist
 -CAform fmt        CA format - default PEM
 -CAkey file        CA key in PEM format unless -CAkeyform is specified
                    if omitted, the key is assumed to be in the CA file
 -CAkeyform fmt     CA key format - default PEM
 -CAserial file     Serial file
 -certopt option    Various certificate text options
 -checkend arg      Check whether the cert expires in the next arg seconds
                    exit 1 if so, 0 if not
 -clrext            Clear all extensions
 -clrreject         Clear all rejected purposes
 -clrtrust          Clear all trusted purposes
 -dates             Both Before and After dates
 -days arg          How long till expiry of a signed certificate - def 30 days
 -email             Print email address(es)
 -enddate           Print notAfter field
 -extensions section
                    Section from config file with X509V3 extensions to add
 -extfile file      Configuration file with X509V3 extensions to add
 -fingerprint       Print the certificate fingerprint
 -hash              Synonym for -subject_hash
 -in file           Input file - default stdin
 -inform fmt        Input format - default PEM (one of DER, NET or PEM)
 -issuer            Print issuer name
 -issuer_hash       Print issuer hash value
 -issuer_hash_old   Print old-style (MD5) issuer hash value
 -keyform fmt       Private key format - default PEM
 -modulus           Print the RSA key modulus
 -nameopt option    Various certificate name options
 -next_serial       Print the next serial number
 -noout             No certificate output
 -ocsp_uri          Print OCSP Responder URL(s)
 -ocspid            Print OCSP hash values for the subject name and public key
 -out file          Output file - default stdout
 -outform fmt       Output format - default PEM (one of DER, NET or PEM)
 -passin src        Private key password source
 -pubkey            Output the public key
 -purpose           Print out certificate purposes
 -req               Input is a certificate request, sign and output
 -serial            Print serial number value
 -set_serial n      Serial number to use
 -setalias arg      Set certificate alias
 -signkey file      Self sign cert with arg
 -sigopt nm:v       Various signature algorithm options
 -startdate         Print notBefore field
 -subject           Print subject name
 -subject_hash      Print subject hash value
 -subject_hash_old  Print old-style (MD5) subject hash value
 -text              Print the certificate in text form
 -trustout          Output a trusted certificate
 -x509toreq         Output a certification request object

keerthana@Mac-677 mtls-poc % 

**What we have now**:
                 MTLS-POC-CA
                     │
                     │ signs
                     ▼
             mtls-server
              server.crt
              server.key

6. Create the client private key:
    openssl genrsa -out certs/client.key 2048

7. Create the client certificate request:
    openssl req -new \
      -key certs/client.key \
      -out certs/client.csr \
      -subj "/CN=mtls-client"

8. Tell the CA this certificate is for client authentication:
    cat > certs/client.ext <<'EOF'
    basicConstraints=CA:FALSE
    keyUsage=digitalSignature,keyEncipherment
    extendedKeyUsage=clientAuth
    EOF

* The important difference is:
server certificate → serverAuth
client certificate → clientAuth

9. Sign the client certificate with our CA:
    openssl x509 -req \
      -in certs/client.csr \
      -CA certs/ca.crt \
      -CAkey certs/ca.key \
      -CAcreateserial \
      -out certs/client.crt \
      -days 365 \
      -sha256 \
      -extfile certs/client.ext

10. Verify it:
    openssl verify -CAfile certs/ca.crt certs/client.crt

keerthana@Keerthanas-MacBook-Air mtls-poc % openssl genrsa -out certs/client.key 2048
Generating RSA private key, 2048 bit long modulus
..................+++++
....................................+++++
e is 65537 (0x10001)
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl req -new \
  -key certs/client.key \
  -out certs/client.csr \
  -subj "/CN=mtls-client"
keerthana@Keerthanas-MacBook-Air mtls-poc % cat > certs/client.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth
EOF
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl x509 -req \
  -in certs/client.csr \
  -CA certs/ca.crt \
  -CAkey certs/ca.key \
  -CAcreateserial \
  -out certs/client.crt \
  -days 365 \
  -sha256 \
  -extfile certs/client.ext
Signature ok
subject=/CN=mtls-client
Getting CA Private Key
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl verify -CAfile certs/ca.crt certs/client.crt
certs/client.crt: OK
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl x509 -in certs/client.crt -noout -subject -issuer -text | grep -A2 "Extended Key Usage"
            X509v3 Extended Key Usage: 
                TLS Web Client Authentication
    Signature Algorithm: sha256WithRSAEncryption
keerthana@Keerthanas-MacBook-Air mtls-poc % 

**At this point your certificate structure is**:
                    MTLS-POC-CA
                    /         \
                   /           \
                  ▼             ▼
          mtls-server      mtls-client
             server            client
                │                 │
          server.crt          client.crt
          server.key          client.key
                │                 │
                └────── mTLS ─────┘

* The server will need server.crt + server.key + ca.crt; the client will need client.crt + client.key + ca.crt.

11. Create the HTTPS server:
cat > server/server.js <<'EOF'
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/certs/server.key'),
  cert: fs.readFileSync('/certs/server.crt'),

  // Trust our CA for client certificates
  ca: fs.readFileSync('/certs/ca.crt'),

  // This is the critical mTLS setting:
  // reject clients that do not provide a valid certificate
  requestCert: true,
  rejectUnauthorized: true
};

https.createServer(options, (req, res) => {
  const clientCert = req.socket.getPeerCertificate();

  console.log('Client certificate subject:', clientCert.subject);

  res.writeHead(200);
  res.end('mTLS connection successful\n');
}).listen(3001, '0.0.0.0', () => {
  console.log('mTLS server listening on port 3001');
});
EOF

* The important configuration is:
    requestCert: true,
    rejectUnauthorized: true

*Meaning*:  requestCert --> "Client, show me your certificate."  &  rejectUnauthorized  -->  "If your certificate isn't trusted, reject you."

12. Create the two container images:

* Create the server Dockerfile:
cat > server/Dockerfile <<'EOF'
FROM node:18-alpine

WORKDIR /app

COPY server.js .

CMD ["node", "server.js"]
EOF

* Build it:
podman build -t mtls-server ./server

* Create the client:
cat > client/Dockerfile <<'EOF'
FROM node:18-alpine

WORKDIR /app

COPY client.js .

CMD ["node", "client.js"]
EOF

* Create client/client.js:
cat > client/client.js <<'EOF'
const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'mtls-server',
  port: 3001,
  path: '/',

  key: fs.readFileSync('/certs/client.key'),
  cert: fs.readFileSync('/certs/client.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),

  rejectUnauthorized: true
};

const req = https.get(options, (res) => {
  let data = '';

  res.on('data', chunk => data += chunk);

  res.on('end', () => {
    console.log('HTTP status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.error('mTLS request failed:', err.message);
  process.exit(1);
});
EOF


keerthana@Keerthanas-MacBook-Air mtls-poc % >....                                                                                                         
  cert: fs.readFileSync('/certs/server.crt'),

  // Trust our CA for client certificates
  ca: fs.readFileSync('/certs/ca.crt'),

  // This is the critical mTLS setting:
  // reject clients that do not provide a valid certificate
  requestCert: true,
  rejectUnauthorized: true
};

https.createServer(options, (req, res) => {
  const clientCert = req.socket.getPeerCertificate();

  console.log('Client certificate subject:', clientCert.subject);

  res.writeHead(200);
  res.end('mTLS connection successful\n');
}).listen(3001, '0.0.0.0', () => {
  console.log('mTLS server listening on port 3001');
});
EOF
keerthana@Keerthanas-MacBook-Air mtls-poc % podman build -t mtls-server ./server
Cannot connect to Podman. Please verify your connection to the Linux system using `podman system connection list`, or try `podman machine init` and `podman machine start` to manage a new Linux VM
Error: unable to connect to Podman socket: failed to connect: dial tcp 127.0.0.1:49741: connect: connection refused
keerthana@Keerthanas-MacBook-Air mtls-poc % podman machine start
Starting machine "podman-machine-default"

This machine is currently configured in rootless mode. If your containers
require root permissions (e.g. ports < 1024), or if you run into compatibility
issues with non-podman clients, you can switch using the following command:

        podman machine set --rootful

API forwarding listening on: /var/folders/vs/93wqfx315h3d4x4ghb4508mr0000gn/T/podman/podman-machine-default-api.sock

The system helper service is not installed; the default Docker API socket
address can't be used by podman. If you would like to install it, run the following commands:

        sudo /opt/homebrew/Cellar/podman/6.1.3/bin/podman-mac-helper install
        podman machine stop; podman machine start

You can still connect Docker API clients by setting DOCKER_HOST using the
following command in your terminal session:

        export DOCKER_HOST='unix:///var/folders/vs/93wqfx315h3d4x4ghb4508mr0000gn/T/podman/podman-machine-default-api.sock'

Machine "podman-machine-default" started successfully
keerthana@Keerthanas-MacBook-Air mtls-poc % cat > client/Dockerfile <<'EOF'
FROM node:18-alpine

WORKDIR /app

COPY client.js .

CMD ["node", "client.js"]
EOF
keerthana@Keerthanas-MacBook-Air mtls-poc % cat > server/Dockerfile <<'EOF'
FROM node:18-alpine

WORKDIR /app

COPY server.js .

CMD ["node", "server.js"]
EOF
keerthana@Keerthanas-MacBook-Air mtls-poc % podman build -t mtls-server ./server
STEP 1/4: FROM node:18-alpine
STEP 2/4: WORKDIR /app
--> Using cache 1a2fd1c87424af81a61c15ebcb626edb368d891e18c55698e0b946fd55d0bbcd
--> 1a2fd1c87424
STEP 3/4: COPY server.js .
--> ab27da386b30
STEP 4/4: CMD ["node", "server.js"]
COMMIT mtls-server
--> 21f2b0c3c413
Successfully tagged localhost/mtls-server:latest
21f2b0c3c413c1f23267ced900680e9dee93f7120cd25748d8d0431906116a0a
keerthana@Keerthanas-MacBook-Air mtls-poc % >....                                                                                                         
  cert: fs.readFileSync('/certs/client.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),

  rejectUnauthorized: true
};

const req = https.get(options, (res) => {
  let data = '';

  res.on('data', chunk => data += chunk);

  res.on('end', () => {
    console.log('HTTP status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.error('mTLS request failed:', err.message);
  process.exit(1);
});
EOF
keerthana@Keerthanas-MacBook-Air mtls-poc % podman build -t mtls-client ./client
STEP 1/4: FROM node:18-alpine
STEP 2/4: WORKDIR /app
--> Using cache 1a2fd1c87424af81a61c15ebcb626edb368d891e18c55698e0b946fd55d0bbcd
--> 1a2fd1c87424
STEP 3/4: COPY client.js .
--> 75a518fd0d5b
STEP 4/4: CMD ["node", "client.js"]
COMMIT mtls-client
--> c210f1be614e
Successfully tagged localhost/mtls-client:latest
c210f1be614e20cb0449be32c19e7fea9e04a652c99171aaf1d109f7731b31b5
keerthana@Keerthanas-MacBook-Air mtls-poc % 


**Then we'll start**:
┌─────────────────────┐
│ mtls-server      │
│                     │
│ HTTPS :3001         │
│ server.crt          │
│ server.key          │
│ ca.crt              │
└──────────┬──────────┘
           │
     mtls-network
           │
┌──────────▼──────────┐
│ mtls-client             │
│                     │
│ client.crt          │
│ client.key          │
│ ca.crt              │
└─────────────────────┘

13. Create the Podman network:
    podman network create mtls-network

14. Start mtls-server as the mTLS server:
    podman run -d \
      --name mtls-server \
      --network mtls-network \
      -p 3001:3001 \
      -v "$(pwd)/certs:/certs:ro" \
      mtls-server

    podman logs mtls-server

    Expected: mTLS server listening on port 3001

15. Run the client:
    podman run --rm \
      --name mtls-client \
      --network mtls-network \
      -v "$(pwd)/certs:/certs:ro" \
      mtls-client

    Expected: HTTP status: 200
    Response: mTLS connection successful

keerthana@Keerthanas-MacBook-Air mtls-poc % podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-server
cfa6c66578dd9df005cf78cb3e0d5c9536a7da07f0b027a1c27ef9db953f4b23
keerthana@Keerthanas-MacBook-Air mtls-poc % podman ps --filter name=mtls-server
podman logs mtls-server
CONTAINER ID  IMAGE                         COMMAND         CREATED        STATUS        PORTS       NAMES
cfa6c66578dd  localhost/mtls-server:latest  node server.js  3 seconds ago  Up 4 seconds              mtls-server
mTLS server listening on port 3001
keerthana@Keerthanas-MacBook-Air mtls-poc % podman logs mtls-server
mTLS server listening on port 3001
Client certificate subject: [Object: null prototype] { CN: 'root-ms' }
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl x509 -in certs/client.crt -noout -subject -issuer
subject= /CN=mtls-client
issuer= /CN=MTLS-POC-CA
keerthana@Keerthanas-MacBook-Air mtls-poc % podman run --rm \
  --name mtls-client \
  --network mtls-network \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-client
HTTP status: 200
Response: mTLS connection successful

keerthana@Keerthanas-MacBook-Air mtls-poc % podman logs mtls-server --tail 5
mTLS server listening on port 3001
Client certificate subject: [Object: null prototype] { CN: 'root-ms' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
keerthana@Keerthanas-MacBook-Air mtls-poc % 

**Now the positive mTLS test is proven**:
Client: mtls-client
        │
        │ client.crt + client.key
        ▼
   mtls-server
        │
        │ server.crt + server.key
        ▼
      MTLS-POC-CA

**have proven**:
- client.crt is issued by MTLS-POC-CA ✅
- Client certificate has clientAuth ✅
- Server certificate has serverAuth ✅
- Server requires a client certificate (requestCert: true) ✅
- Server rejects untrusted clients (rejectUnauthorized: true) ✅
- Valid client certificate → HTTP 200 ✅
- Server sees CN=mtls-client ✅

* Now test the important failure case:
1. We should fix the test client so it can intentionally run with or without a client certificate:
Update client/client.js:
cat > client/client.js <<'EOF'
const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'mtls-server',
  port: 3001,
  path: '/',
  ca: fs.readFileSync('/certs/ca.crt'),
  rejectUnauthorized: true
};

if (process.env.USE_CLIENT_CERT === 'true') {
  options.key = fs.readFileSync('/certs/client.key');
  options.cert = fs.readFileSync('/certs/client.crt');
  console.log('Client certificate: ENABLED');
} else {
  console.log('Client certificate: DISABLED');
}

const req = https.get(options, (res) => {
  let data = '';

  res.on('data', chunk => data += chunk);

  res.on('end', () => {
    console.log('HTTP status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.error('mTLS request failed:', err.message);
  process.exit(1);
});
EOF

podman build -t mtls-client ./client

podman run --rm \
  --name mtls-client \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-client

2. Now perform the real negative test:
podman run --rm \
  --name mtls-client-no-cert \
  --network mtls-network \
  -e USE_CLIENT_CERT=false \
  -v "$(pwd)/certs/ca.crt:/certs/ca.crt:ro" \
  mtls-client

keerthana@Keerthanas-MacBook-Air mtls-poc % >....                                                                                                         
  options.cert = fs.readFileSync('/certs/client.crt');
  console.log('Client certificate: ENABLED');
} else {
  console.log('Client certificate: DISABLED');
}

const req = https.get(options, (res) => {
  let data = '';

  res.on('data', chunk => data += chunk);

  res.on('end', () => {
    console.log('HTTP status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.error('mTLS request failed:', err.message);
  process.exit(1);
});
EOF
keerthana@Keerthanas-MacBook-Air mtls-poc % podman build -t mtls-client ./client
STEP 1/4: FROM node:18-alpine
STEP 2/4: WORKDIR /app
--> Using cache 1a2fd1c87424af81a61c15ebcb626edb368d891e18c55698e0b946fd55d0bbcd
--> 1a2fd1c87424
STEP 3/4: COPY client.js .
--> b83a6000ea46
STEP 4/4: CMD ["node", "client.js"]
COMMIT mtls-client
--> d8692d74925c
Successfully tagged localhost/mtls-client:latest
d8692d74925cb727ce8954c6dd2c159f956148a1b65c7c8e4d590b1bff732a2f
keerthana@Keerthanas-MacBook-Air mtls-poc % podman run --rm \
  --name mtls-client \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-client
Client certificate: ENABLED
HTTP status: 200
Response: mTLS connection successful

keerthana@Keerthanas-MacBook-Air mtls-poc % podman run --rm \
  --name mtls-client-no-cert \
  --network mtls-network \
  -e USE_CLIENT_CERT=false \
  -v "$(pwd)/certs/ca.crt:/certs/ca.crt:ro" \
  mtls-client
Client certificate: DISABLED
*mTLS request failed: A09C558AFFFF0000:error:0A00045C:SSL routines:ssl3_read_bytes:tlsv13 alert certificate required:../deps/openssl/openssl/ssl/record/rec_layer_s3.c:1605:SSL alert number 116*

keerthana@Keerthanas-MacBook-Air mtls-poc % 

**This gives us the two critical proofs**:
    VALID CLIENT CERT
          │
          ▼
      mTLS server
          │
          ▼
        200 ✅


    NO CLIENT CERT
          │
          ▼
      mTLS server
          │
          ▼
       REJECTED ❌

- result is what proves the server is enforcing mutual TLS.

============================================================================================================================================

* Next prove the untrusted-client case: a client certificate exists, but mtls-server does not trust the CA that signed it:

1. Create a second, untrusted CA:
openssl genrsa -out certs/bad-ca.key 2048

openssl req -x509 -new -nodes \
  -key certs/bad-ca.key \
  -sha256 \
  -days 365 \
  -out certs/bad-ca.crt \
  -subj "/CN=UNTRUSTED-CA"

2. Create an untrusted client certificate
openssl genrsa -out certs/bad-client.key 2048

openssl req -new \
  -key certs/bad-client.key \
  -out certs/bad-client.csr \
  -subj "/CN=untrusted-client"

* Create its client-auth extension:
cat > certs/bad-client.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth
EOF

* Sign it with the wrong CA:
openssl x509 -req \
  -in certs/bad-client.csr \
  -CA certs/bad-ca.crt \
  -CAkey certs/bad-ca.key \
  -CAcreateserial \
  -out certs/bad-client.crt \
  -days 365 \
  -sha256 \
  -extfile certs/bad-client.ext

3. Run the client with the untrusted certificate:

* Mount the bad certificate over the normal client certificate paths:
podman run --rm \
  --name mtls-client-untrusted \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/certs/ca.crt:/certs/ca.crt:ro" \
  -v "$(pwd)/certs/bad-client.crt:/certs/client.crt:ro" \
  -v "$(pwd)/certs/bad-client.key:/certs/client.key:ro" \
  mtls-client

Expected result:  connection rejected, with an error related to certificate verification / unknown CA.

* Why?
                    MTLS-POC-CA
                   /           \
                  /             \
         mtls-server          mtls-client
                              client.crt
                                  ↑
                                  │
                            signed by
                                  │
                           UNTRUSTED-CA

* This gives us the three fundamental mTLS results:
| Test                               | Result     |
| ---------------------------------- | ---------- |
| Valid client certificate           | ✅ Accepted |
| No client certificate              | ❌ Rejected |
| Certificate signed by untrusted CA | ❌ Rejected |


keerthana@Keerthanas-MacBook-Air mtls-poc % openssl genrsa -out certs/bad-ca.key 2048
Generating RSA private key, 2048 bit long modulus
............+++++
....................................................+++++
e is 65537 (0x10001)
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl req -x509 -new -nodes \
  -key certs/bad-ca.key \
  -sha256 \
  -days 365 \
  -out certs/bad-ca.crt \
  -subj "/CN=UNTRUSTED-CA" 
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl genrsa -out certs/bad-client.key 2048
Generating RSA private key, 2048 bit long modulus
.................+++++
......................................................................................................+++++
e is 65537 (0x10001)
keerthana@Keerthanas-MacBook-Air mtls-poc % cat > certs/bad-client.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth
EOF
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl x509 -req \
  -in certs/bad-client.csr \
  -CA certs/bad-ca.crt \
  -CAkey certs/bad-ca.key \
  -CAcreateserial \
  -out certs/bad-client.crt \
  -days 365 \
  -sha256 \
  -extfile certs/bad-client.ext
certs/bad-client.csr: No such file or directory

* Run these two commands:
openssl req -new \
  -key certs/bad-client.key \
  -out certs/bad-client.csr \
  -subj "/CN=untrusted-client"

* Then sign it with the untrusted CA:
openssl x509 -req \
  -in certs/bad-client.csr \
  -CA certs/bad-ca.crt \
  -CAkey certs/bad-ca.key \
  -CAcreateserial \
  -out certs/bad-client.crt \
  -days 365 \
  -sha256 \
  -extfile certs/bad-client.ext

* Verify that the bad client certificate is valid against its own CA:
openssl verify \
  -CAfile certs/bad-ca.crt \
  certs/bad-client.crt

Expected: certs/bad-client.crt: OK

* Then run:
podman run --rm \
  --name mtls-client-untrusted \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/certs/ca.crt:/certs/ca.crt:ro" \
  -v "$(pwd)/certs/bad-client.crt:/certs/client.crt:ro" \
  -v "$(pwd)/certs/bad-client.key:/certs/client.key:ro" \
  mtls-client

keerthana@Keerthanas-MacBook-Air mtls-poc % openssl req -new \
  -key certs/bad-client.key \
  -out certs/bad-client.csr \
  -subj "/CN=untrusted-client"
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl x509 -req \
  -in certs/bad-client.csr \
  -CA certs/bad-ca.crt \
  -CAkey certs/bad-ca.key \
  -CAcreateserial \
  -out certs/bad-client.crt \
  -days 365 \
  -sha256 \
  -extfile certs/bad-client.ext
Signature ok
subject=/CN=untrusted-client
Getting CA Private Key
keerthana@Keerthanas-MacBook-Air mtls-poc % openssl verify \
  -CAfile certs/bad-ca.crt \
  certs/bad-client.crt
certs/bad-client.crt: OK
keerthana@Keerthanas-MacBook-Air mtls-poc % podman run --rm \
  --name mtls-client-untrusted \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/certs/ca.crt:/certs/ca.crt:ro" \
  -v "$(pwd)/certs/bad-client.crt:/certs/client.crt:ro" \
  -v "$(pwd)/certs/bad-client.key:/certs/client.key:ro" \
  mtls-client
Client certificate: ENABLED
mTLS request failed: socket hang up
keerthana@Keerthanas-MacBook-Air mtls-poc %

**file key,ext,csr,crt?**
1. .key = private key — secret cryptographic key used by the server/client to prove it owns the certificate and participate in TLS encryption. Never share it.
2. .csr = Certificate Signing Request — a request containing the identity/public key information that you send to a CA so the CA can issue a certificate.
3. .crt = certificate — the CA-signed identity document containing the public key, subject, issuer, validity, and allowed usage.
4. .ext = certificate extensions configuration — tells OpenSSL what the certificate is allowed to be used for, such as serverAuth or clientAuth, and names like mtls-server.

