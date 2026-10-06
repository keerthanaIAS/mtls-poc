# The positive flow is:
                 Trusted CA
              ca.crt / ca.key
                /         \
               ↓           ↓
        server.crt       client.crt
        server.key       client.key

Client ───────────────→ Server
       server.crt
       ← client.crt
       
       Both sides validate
       certificates + prove
       private-key ownership
       
              ✓ SUCCESS

## Negative test cases:
| Test | What we break                                    | Expected result |
| ---- | ------------------------------------------------ | --------------- |
| 1    | Client certificate signed by an **untrusted CA** | TLS fails       |
| 2    | Server certificate signed by an **untrusted CA** | TLS fails       |
| 3    | Client certificate/key **mismatch**              | TLS fails       |
| 4    | Server certificate/key **mismatch**              | TLS fails       |
| 5    | Client certificate missing                       | TLS fails       |
| 6    | Invalid/expired certificate                      | TLS fails       |
| 7    | Certificate hostname/SAN mismatch                | TLS fails       |

### Terminal Log:

**Untrusted certificate**:
keerthana@Mac-819 mtls-poc % mkdir -p bad-client-certs
keerthana@Mac-819 mtls-poc % cp certs/ca.crt bad-client-certs/ca.crt
cp bad-ca/bad-client.crt bad-client-certs/client.crt
cp bad-ca/bad-client.key bad-client-certs/client.key

ls -l bad-client-certs
total 24
-rw-r--r--@ 1 keerthana  staff  1675 Oct  6 12:29 ca.crt
-rw-r--r--@ 1 keerthana  staff   981 Oct  6 12:29 client.crt
-rw-r--r--@ 1 keerthana  staff  1675 Oct  6 12:29 client.key
keerthana@Mac-819 mtls-poc % podman build -t mtls-server ./server
podman build -t mtls-client ./client
STEP 1/4: FROM node:18-alpine
STEP 2/4: WORKDIR /app
--> Using cache 1a2fd1c87424af81a61c15ebcb626edb368d891e18c55698e0b946fd55d0bbcd
--> 1a2fd1c87424
STEP 3/4: COPY server.js .
--> Using cache ab27da386b30215d1c597059721673aec9cba89c4c62cfc346021690398fd1df
--> ab27da386b30
STEP 4/4: CMD ["node", "server.js"]
--> Using cache 21f2b0c3c413c1f23267ced900680e9dee93f7120cd25748d8d0431906116a0a
COMMIT mtls-server
--> 21f2b0c3c413
Successfully tagged localhost/mtls-server:latest
21f2b0c3c413c1f23267ced900680e9dee93f7120cd25748d8d0431906116a0a
STEP 1/4: FROM node:18-alpine
STEP 2/4: WORKDIR /app
--> Using cache 1a2fd1c87424af81a61c15ebcb626edb368d891e18c55698e0b946fd55d0bbcd
--> 1a2fd1c87424
STEP 3/4: COPY client.js .
--> Using cache b83a6000ea464edc2eb79406a1e09631aaee6d535b65e2dd8ae2bb5a2aa8541c
--> b83a6000ea46
STEP 4/4: CMD ["node", "client.js"]
--> Using cache d8692d74925cb727ce8954c6dd2c159f956148a1b65c7c8e4d590b1bff732a2f
COMMIT mtls-client
--> d8692d74925c
Successfully tagged localhost/mtls-client:latest
d8692d74925cb727ce8954c6dd2c159f956148a1b65c7c8e4d590b1bff732a2f
keerthana@Mac-819 mtls-poc % podman images | grep mtls
localhost/mtls-client                       latest                   d8692d74925c  21 hours ago   128 MB
localhost/mtls-server                       latest                   21f2b0c3c413  22 hours ago   128 MB
keerthana@Mac-819 mtls-poc % podman network create mtls-network 2>/dev/null || true
keerthana@Mac-819 mtls-poc % podman rm -f mtls-server 2>/dev/null || true

podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-server
mtls-server
b7d3326b89f8c07d6668106c49544567697723f838731924b26bd8630464debe
keerthana@Mac-819 mtls-poc % podman logs mtls-server
mTLS server listening on port 3001
keerthana@Mac-819 mtls-poc % podman run --rm \
  --name mtls-client-test1 \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/bad-client-certs:/certs:ro" \
  mtls-client
Client certificate: ENABLED
mTLS request failed: socket hang up
keerthana@Mac-819 mtls-poc % podman rm -f mtls-server
mtls-server
keerthana@Mac-819 mtls-poc % rm -rf bad-server-certs
mkdir -p bad-server-certs

cp bad-ca/bad-server.crt bad-server-certs/server.crt
cp bad-ca/bad-server.key bad-server-certs/server.key
cp certs/ca.crt bad-server-certs/ca.crt

ls -l bad-server-certs
total 24
-rw-r--r--@ 1 keerthana  staff  1675 Oct  6 12:32 ca.crt
-rw-r--r--@ 1 keerthana  staff   985 Oct  6 12:32 server.crt
-rw-r--r--@ 1 keerthana  staff  1675 Oct  6 12:32 server.key
keerthana@Mac-819 mtls-poc % podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/bad-server-certs:/certs:ro" \
  mtls-server
01ade24eb331f438b611b3cec5896ee45328ca6a79616a8e0f1f266c38641d4f
keerthana@Mac-819 mtls-poc % podman logs mtls-server
mTLS server listening on port 3001
keerthana@Mac-819 mtls-poc % podman run --rm \
  --name mtls-client-test2 \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-client
Client certificate: ENABLED
mTLS request failed: unable to verify the first certificate
keerthana@Mac-819 mtls-poc % 

| Test | Negative condition               | Result               |
| ---- | -------------------------------- | -------------------- |
| 1    | Untrusted **client** certificate | ✅ Failed as expected |
| 2    | Untrusted **server** certificate | ✅ Failed as expected |


**Certificate mismatch**:
keerthana@Mac-819 mtls-poc % podman rm -f mtls-server
mtls-server
keerthana@Mac-819 mtls-poc % rm -rf mismatch-client-certs
mkdir -p mismatch-client-certs

cp certs/ca.crt mismatch-client-certs/ca.crt
cp certs/client.crt mismatch-client-certs/client.crt
cp bad-ca/wrong-client.key mismatch-client-certs/client.key
keerthana@Mac-819 mtls-poc % openssl x509 -in mismatch-client-certs/client.crt -pubkey -noout > /tmp/cert-public.pem
openssl pkey -in mismatch-client-certs/client.key -pubout > /tmp/key-public.pem

diff /tmp/cert-public.pem /tmp/key-public.pem
2,8c2,8
< MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsYKFfYLYXL7kJM1owKmt
< Gb/2Erkb7OtbA9A2l98t4idIbRDvEB9Pz/ZLgMal3xi+Jo2X9EKCnsf34UzFzOXQ
< YEHIMCWMPP3X/Bp3h7ueaj+9vVYV+11uWlE0qFoAxA71QZcqZY+NCZw0UBrtqZ2v
< 66MajKY0e0XGf0L96AqOVdGPeyVzQRVqow5CI+3c8YopEWv4ckuSOkPJeIU+q/TU
< PcXA1Fb2Q8T8ee55IeGA5ro8Ir+rFfHgTlvYJlTJCNEqvpLjmoi/pitO+uFPhxEB
< jOmw+3ChKUR86mCCxtUMHtO/Isbnz/bK/57NsRTnn5crp62nzlCqUFVOT4ZgNJ5b
< LQIDAQAB
---
> MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz3UJhVm8QVD2Yr6AztBy
> j2utmFA+z5jGaflMojUM8IoDyeq7x8oi6zO52IVJl8Ga0GRTW3BbLZ+Ec4oJ5bZb
> 2ALhVoEAhD7OIicPb6NKUk2e3+WNZ6AQMgcTpkqYh4hdMPVDNxHm8ZG3wUFg9FTj
> pEENQyyvvzee15leNhp7nR3cYc17mrSm8UnP4wqBqcchrwfUh1H8ykamyynvvasy
> gZx50+ClUsqJNvt3sCAEDvFHRObqU48oGrH9FKojEQSf91RzoNWiAy8WrX4fuvXE
> 34OA5YGmcJKxbpSxbeE9m6A0Y2nWCqT8sDSdjV0sTqo6anEeYzAHbDk/KoffLMxN
> pwIDAQAB
keerthana@Mac-819 mtls-poc % podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-server
03a2b83166e8aad9d0cde22b7c022a9d30c1dcc80a16154b2d0291ef5f86d709
keerthana@Mac-819 mtls-poc % podman logs mtls-server
mTLS server listening on port 3001
keerthana@Mac-819 mtls-poc % podman run --rm \
  --name mtls-client-test3 \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/mismatch-client-certs:/certs:ro" \
  mtls-client
Client certificate: ENABLED
node:internal/tls/secure-context:93
  context.setKey(key, passphrase);
          ^

Error: error:05800074:x509 certificate routines::key values mismatch
    at setKey (node:internal/tls/secure-context:93:11)
    at configSecureContext (node:internal/tls/secure-context:200:7)
    at Object.createSecureContext (node:_tls_common:117:3)
    at Object.connect (node:_tls_wrap:1750:48)
    at Agent.createConnection (node:https:158:22)
    at Agent.createSocket (node:_http_agent:341:26)
    at Agent.addRequest (node:_http_agent:288:10)
    at new ClientRequest (node:_http_client:342:16)
    at request (node:https:366:10)
    at Object.get (node:https:400:15) {
  library: 'x509 certificate routines',
  reason: 'key values mismatch',
  code: 'ERR_OSSL_X509_KEY_VALUES_MISMATCH'
}

Node.js v18.20.8
keerthana@Mac-819 mtls-poc % 

keerthana@Mac-819 mtls-poc % cd /Users/keerthana/Desktop/mtls-poc

rm -rf mismatch-server-certs
mkdir -p mismatch-server-certs
keerthana@Mac-819 mtls-poc % cp certs/server.crt mismatch-server-certs/server.crt
cp certs/ca.crt mismatch-server-certs/ca.crt
keerthana@Mac-819 mtls-poc % openssl genrsa -out mismatch-server-certs/server.key 2048
Generating RSA private key, 2048 bit long modulus
....................+++++
.........................................................................................................................................+++++
e is 65537 (0x10001)
keerthana@Mac-819 mtls-poc % openssl x509 \
  -in mismatch-server-certs/server.crt \
  -pubkey -noout > /tmp/server-cert-public.pem

openssl pkey \
  -in mismatch-server-certs/server.key \
  -pubout > /tmp/server-key-public.pem

diff /tmp/server-cert-public.pem /tmp/server-key-public.pem
2,8c2,8
< MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArncpRBY8XTyOBZOuJi7b
< t3AXSMXtD+iVvwp7T7quyhNHF9TIum7QDQ3SQT62DXruoPdC9HVWtMf2SVGp2B5i
< 5PqjeNw76c5dooavAYJkXcnNGKs/86ew60sRMcGECG0vnwqs7TqzLwBQWlHd6+fx
< SQWw7djzo+eT+D+S8ASvt+TmJ49UUCIKEtH+4mxu9UJikk7i0Qm+pymMpYmwVePJ
< bmkW409/jtE6nnEEkGxTaVZ3AYk+qw56RFVg2N+mVxk0Ymupjf3VNc6Ds+sXSb7B
< aOuEmhIjODITumxSswkM70t93mu7w6aqXsRYjKFWJwNaGHacAhZERtA1sDRcfwKy
< iQIDAQAB
---
> MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3R3nn5KOKNcCAJGgWd4K
> aWH/kZBfLnDflgDdOuKaT8eg5gvAY/1OWHKOqMJZeb3uVFrPL0PjwnfSb01Okq8l
> eVV7ibc5r0EBzV4a9L4z2n68Yrw//SfDwHqcY9jiSY4psWeld/dsuWYVCoraom5p
> p3/owXOkr8e5W0DDQzKv+rOQYvn3e6v/F58kI/YJAmO6kdPCh3Jtd9dbsuUGe5u/
> HInJOoFPXFf/0Bu8GaKQf0RBHz4K8WMiFcLyUHCYjLF48Kh3Op8RD6EMyPrigID+
> o+1BersZ1J21WPWe/jYFIyhGjmhXXT4Xi0T2b70Ie55661Nk22VDhnVdZ4FxYn2v
> 9QIDAQAB
keerthana@Mac-819 mtls-poc % podman rm -f mtls-server 2>/dev/null || true
keerthana@Mac-819 mtls-poc % podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/mismatch-server-certs:/certs:ro" \
  mtls-server
dc21a2b039f8544df5dc5c3566e18fc2ce302b45bde903703cada9704ede9f65
keerthana@Mac-819 mtls-poc % podman logs mtls-server
node:internal/tls/secure-context:93
  context.setKey(key, passphrase);
          ^

Error: error:05800074:x509 certificate routines::key values mismatch
    at setKey (node:internal/tls/secure-context:93:11)
    at configSecureContext (node:internal/tls/secure-context:200:7)
    at Object.createSecureContext (node:_tls_common:117:3)
    at Server.setSecureContext (node:_tls_wrap:1471:27)
    at Server (node:_tls_wrap:1335:8)
    at new Server (node:https:76:3)
    at Object.createServer (node:https:120:10)
    at Object.<anonymous> (/app/server.js:17:7)
    at Module._compile (node:internal/modules/cjs/loader:1364:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1422:10) {
  library: 'x509 certificate routines',
  reason: 'key values mismatch',
  code: 'ERR_OSSL_X509_KEY_VALUES_MISMATCH'
}

Node.js v18.20.8
keerthana@Mac-819 mtls-poc % 

| # | Broken condition                          | Evidence                                 | Result     |
| - | ----------------------------------------- | ---------------------------------------- | ---------- |
| 1 | Client certificate signed by untrusted CA | `socket hang up`                         | ✅ Rejected |
| 2 | Server certificate signed by untrusted CA | `unable to verify the first certificate` | ✅ Rejected |
| 3 | Client cert + wrong private key           | `ERR_OSSL_X509_KEY_VALUES_MISMATCH`      | ✅ Rejected |
| 4 | Server cert/key mismatch  | TLS server fails to start | `ERR_OSSL_X509_KEY_VALUES_MISMATCH` | ✅ Rejected |

**Missing Certificate**:
keerthana@Mac-819 mtls-poc % podman rm -f mtls-server 2>/dev/null || true

mtls-server
keerthana@Mac-819 mtls-poc % podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-server
127f8ed67617a03effecce02dd961bb3792d7ed099ef002df98855c1cb3765d9
keerthana@Mac-819 mtls-poc % podman logs mtls-server
mTLS server listening on port 3001
keerthana@Mac-819 mtls-poc % podman run --rm \
  --name mtls-client-test5 \
  --network mtls-network \
  -e USE_CLIENT_CERT=false \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-client
Client certificate: DISABLED
mTLS request failed: A09C6AB4FFFF0000:error:0A00045C:SSL routines:ssl3_read_bytes:tlsv13 alert certificate required:../deps/openssl/openssl/ssl/record/rec_layer_s3.c:1605:SSL alert number 116

keerthana@Mac-819 mtls-poc % 

| Test                       | Expected               | Actual                 | Result |
| -------------------------- | ---------------------- | ---------------------- | ------ |
| Missing client certificate | TLS handshake rejected | `certificate required` | ✅ PASS |

**Expired Certificate**:
keerthana@Mac-819 mtls-poc % rm -rf expired-client-certs
mkdir -p expired-client-certs/newcerts
keerthana@Mac-819 mtls-poc % touch expired-client-certs/index.txt
echo 1000 > expired-client-certs/serial
keerthana@Mac-819 mtls-poc % openssl genrsa \
  -out expired-client-certs/client.key \
  2048
Generating RSA private key, 2048 bit long modulus
......................................................................................+++++
.........................+++++
e is 65537 (0x10001)
keerthana@Mac-819 mtls-poc % openssl req -new \
  -key expired-client-certs/client.key \
  -out expired-client-certs/client.csr \
  -subj "/CN=expired-client"
keerthana@Mac-819 mtls-poc % cat > expired-client-certs/openssl.cnf <<'EOF'
[ ca ]
default_ca = CA_default

[ CA_default ]
database = ./index.txt
serial = ./serial
new_certs_dir = ./newcerts
certificate = ../certs/ca.crt
private_key = ../certs/ca.key
default_md = sha256
policy = policy_any
default_days = 365

[ policy_any ]
commonName = supplied
EOF
keerthana@Mac-819 mtls-poc % cd expired-client-certs

openssl ca \
  -config openssl.cnf \
  -in client.csr \
  -out client.crt \
  -startdate 250101000000Z \
  -enddate 250102000000Z \
  -batch
Using configuration from openssl.cnf
Check that the request matches the signature
Signature ok
The Subject's Distinguished Name is as follows
commonName            :ASN.1 12:'expired-client'
Certificate is to be certified until Jan  2 00:00:00 2025 GMT

Write out database with 1 new entries
Data Base Updated
keerthana@Mac-819 expired-client-certs % cd ..
keerthana@Mac-819 mtls-poc % openssl x509 \
  -in expired-client-certs/client.crt \
  -noout \
  -subject \
  -issuer \
  -dates
subject= /CN=expired-client
issuer= /CN=MTLS-POC-CA
notBefore=Jan  1 00:00:00 2025 GMT
notAfter=Jan  2 00:00:00 2025 GMT
keerthana@Mac-819 mtls-poc % podman rm -f mtls-server 2>/dev/null || true

podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-server
mtls-server
8aa5a89f89a835faed80b93efce37d76231b0e6d524a6bc277c9ac136b864841
keerthana@Mac-819 mtls-poc % podman logs mtls-server
mTLS server listening on port 3001
keerthana@Mac-819 mtls-poc % cp certs/ca.crt expired-client-certs/ca.crt
keerthana@Mac-819 mtls-poc % podman run --rm \
  --name mtls-client-test6 \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/expired-client-certs:/certs:ro" \
  mtls-client
Client certificate: ENABLED
mTLS request failed: socket hang up
keerthana@Mac-819 mtls-poc % podman logs mtls-server

* Expired Client Certs:
========================

| File            | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `client.key`    | Client's **private key**                                          |
| `client.csr`    | Certificate Signing Request — asks the CA to create a certificate |
| `client.crt`    | The **expired client certificate** we actually tested             |
| `ca.crt`        | Trusted CA certificate, needed by the client to trust the server  |
| `openssl.cnf`   | Instructions for OpenSSL's CA process                             |
| `index.txt`     | CA database tracking certificates it has issued                   |
| `serial`        | Keeps track of certificate serial numbers                         |
| `newcerts/`     | Directory where OpenSSL CA can store issued certificates          |
| `.old`, `.attr` | Files OpenSSL creates while maintaining its CA database           |
 
* For the container to perform the test, we only needed:
ca.crt
client.crt
client.key

Everything else was OpenSSL bookkeeping used to *generate the expired certificate*.

So you can think of it as:
                    Certificate creation
                           │
             ┌─────────────┴─────────────┐
             │                           │
       OpenSSL CA files             Actual result
       (bookkeeping)                │
       ├─ openssl.cnf               ├─ client.crt
       ├─ index.txt                 └─ client.key
       ├─ serial
       └─ newcerts/

| Test                       | Expected               | Actual                                | Result |
| -------------------------- | ---------------------- | ------------------------------------- | ------ |
| Expired client certificate | TLS handshake rejected | `mTLS request failed: socket hang up` | ✅ PASS |

**Server hostname/SAN mismatch**:
keerthana@Mac-819 mtls-poc % rm -rf hostname-mismatch-certs
mkdir -p hostname-mismatch-certs
keerthana@Mac-819 mtls-poc % openssl genrsa \
  -out hostname-mismatch-certs/server.key \
  2048
Generating RSA private key, 2048 bit long modulus
.........................................................................................+++++
......................................................................................................+++++
e is 65537 (0x10001)
keerthana@Mac-819 mtls-poc % openssl req -new \
  -key hostname-mismatch-certs/server.key \
  -out hostname-mismatch-certs/server.csr \
  -subj "/CN=wrong-server"
keerthana@Mac-819 mtls-poc % cat > hostname-mismatch-certs/server-ext.cnf <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:wrong-server
EOF
keerthana@Mac-819 mtls-poc % cp certs/ca.crt hostname-mismatch-certs/ca.crt
cp certs/ca.key hostname-mismatch-certs/ca.key
keerthana@Mac-819 mtls-poc % openssl x509 -req \
  -in hostname-mismatch-certs/server.csr \
  -CA hostname-mismatch-certs/ca.crt \
  -CAkey hostname-mismatch-certs/ca.key \
  -CAcreateserial \
  -out hostname-mismatch-certs/server.crt \
  -days 365 \
  -sha256 \
  -extfile hostname-mismatch-certs/server-ext.cnf
Signature ok
subject=/CN=wrong-server
Getting CA Private Key
keerthana@Mac-819 mtls-poc % openssl x509 \
  -in hostname-mismatch-certs/server.crt \
  -noout \
  -issuer \
  -subject \
  -ext subjectAltName
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

keerthana@Mac-819 mtls-poc % podman rm -f mtls-server 2>/dev/null || true
mtls-server
keerthana@Mac-819 mtls-poc % podman run -d \
  --name mtls-server \
  --network mtls-network \
  -v "$(pwd)/hostname-mismatch-certs:/certs:ro" \
  mtls-server
f527700ade32e07d557c4c56e642e7dd96d1f5729fa77ea082afe7c9deeae032
keerthana@Mac-819 mtls-poc % podman logs mtls-server
mTLS server listening on port 3001
keerthana@Mac-819 mtls-poc % podman run --rm \
  --name mtls-client-test7 \
  --network mtls-network \
  -e USE_CLIENT_CERT=true \
  -v "$(pwd)/certs:/certs:ro" \
  mtls-client
Client certificate: ENABLED
mTLS request failed: Hostname/IP does not match certificate's altnames: Host: mtls-server. is not in the cert's altnames: DNS:wrong-server
keerthana@Mac-819 mtls-poc % 

* Hostname mismatch:
========================

| File             | Meaning                   | Used for                                                    |
| ---------------- | ------------------------- | ----------------------------------------------------------- |
| `server-ext.cnf` | Certificate configuration | Tells OpenSSL what extensions/SAN to put in the certificate |
| `ca.srl`         | Serial-number bookkeeping | Gives the issued certificate a unique serial number         |

And after the test, both can be deleted. They are only temporary files used while generating the test certificate.

* The actual files needed by the server were only:
server.crt
server.key
ca.crt

And for this particular test, server.crt deliberately contained:
        SAN = DNS:wrong-server

| Test                         | Expected              | Actual                               | Result |
| ---------------------------- | --------------------- | ------------------------------------ | ------ |
| Server hostname/SAN mismatch | Client rejects server | `mtls-server` not in certificate SAN | ✅ PASS |
