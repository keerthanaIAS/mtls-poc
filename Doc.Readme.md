# TLS and mTLS – Learning and Practical Implementation POC

## 1. Objective

The objective of these POCs was to understand how TLS and mTLS secure communication between applications and microservices.

I explored:
- TLS handshake and certificate validation.
- Difference between TLS and mutual TLS.
- Certificate Authority (CA) and certificate lifecycle.
- Service-to-service mTLS communication.
- Docker, Podman, and Kubernetes implementations.
- Certificate management using Vault and cert-manager.
- Automated certificate renewal using cert-manager and Certbot.
- Application-layer encryption using AES-256-GCM and RSA-OAEP.
- Positive and negative security testing.

---

# PART 1: TLS FUNDAMENTALS

## 2. What is TLS?

TLS stands for Transport Layer Security.

TLS is a cryptographic protocol that protects communication between two applications over a network.

It provides three major security properties:

1. **Confidentiality:** Data is encrypted so unauthorized parties cannot read it.
2. **Integrity:** Data cannot be modified without detection.
3. **Authentication:** The communicating server can prove its identity using a certificate.

Example:

When a client communicates with an HTTPS server, TLS establishes a secure connection before application data is exchanged.

### 2.1 How TLS works

1. Client connects to the server.
2. Client sends a ClientHello message containing supported TLS versions and cryptographic options.
3. Server responds with ServerHello.
4. Server presents its TLS certificate.
5. Client validates the certificate chain and server hostname.
6. Both sides establish shared session keys.
7. Encrypted application communication begins.

### 2.2 TLS handshake flow

```text
Client                         Server
  |                               |
  |-------- ClientHello --------->|
  |                               |
  |<------- ServerHello ----------|
  |<------- Server Certificate ---|
  |                               |
  |  Validate certificate         |
  |                               |
  |<---- Key establishment ------>|
  |                               |
  |====== Secure TLS session =====|
  |                               |
  |<===== Encrypted data ========>|
```

### 2.3 TLS versions

I explored TLS 1.2 and TLS 1.3 configurations in the POCs.

| TLS version | Learning |
|---|---|
| TLS 1.2 | Supports secure communication with certificate-based authentication |
| TLS 1.3 | Simplifies the handshake and removes older cryptographic options |

The Node.js HTTPS and gRPC services were configured with a minimum TLS version of 1.2.

---

## 3. What is a Digital Certificate?

A digital certificate is used to prove the identity of a server or client.

It contains:
- Subject information.
- Public key.
- Issuer information.
- Validity period.
- Subject Alternative Name (SAN).
- Key Usage and Extended Key Usage.
- Digital signature from the issuing CA.

### 3.1 Certificate components

| Component | Purpose |
|---|---|
| Subject | Identifies the certificate owner |
| Issuer | Identifies the CA that issued the certificate |
| Public key | Used in cryptographic operations |
| Private key | Kept secret by the certificate owner |
| SAN | Identifies valid DNS names or IP addresses |
| Not Before / Not After | Defines certificate validity |
| EKU | Defines permitted certificate purposes |

### 3.2 What is a Certificate Authority?

A Certificate Authority (CA) is a trusted entity that signs and issues certificates.

For our POCs, we created private CAs and also experimented with ACME-based certificate issuance.

Certificate hierarchy:

```text
                 Root CA
                    |
             Intermediate CA
                    |
          ----------------------
          |                    |
      Server Cert          Client Cert
```

The CA's public certificate is distributed to parties that need to verify certificates. The CA's private key must remain protected.

### 3.3 What is SAN?

Subject Alternative Name identifies the DNS names or IP addresses for which a certificate is valid.

Example:

```text
DNS: transaction-ms
DNS: transaction-ms.mtls-services.svc.cluster.local
```

If a client connects to a hostname that does not match the server certificate SAN, hostname verification should fail.

### 3.4 What is EKU?

Extended Key Usage restricts the purpose for which a certificate can be used.

| EKU | Purpose |
|---|---|
| serverAuth | Server authentication |
| clientAuth | Client authentication |

This is important in mTLS because both the server and client have certificate-based identity requirements.

---

# PART 2: TLS VS mTLS

## 4. What is mTLS?

mTLS stands for Mutual Transport Layer Security.

Normal TLS generally authenticates the server to the client.

mTLS authenticates both the server and the client using certificates.

### 4.1 TLS flow

```text
Client                         Server
  |                               |
  |---------- Connect ----------->|
  |<------ Server Certificate ----|
  |                               |
  |  Verify server identity       |
  |                               |
  |======= Secure session ========|
```

### 4.2 mTLS flow

```text
Client                         Server
  |                               |
  |---------- Connect ----------->|
  |<------ Server Certificate ----|
  |                               |
  |  Verify server identity       |
  |                               |
  |<------ Request Certificate ---|
  |                               |
  |------- Client Certificate --->|
  |                               |
  |  Verify client identity       |
  |                               |
  |======= Secure session ========|
  |                               |
  |<===== Encrypted data ========>|
```

### 4.3 TLS vs mTLS comparison

| TLS | mTLS |
|---|---|
| Usually authenticates the server | Authenticates both client and server |
| Client verifies server certificate | Both parties verify certificates |
| Client certificate is generally optional | Client certificate is required when configured |
| Common for browser-to-server HTTPS | Useful for service-to-service communication |
| Protects the connection | Protects the connection and verifies both endpoint identities |

---

# PART 3: BASIC TLS AND mTLS POC

## 5. Basic Node.js TLS/mTLS POC

### Objective

I created a basic Node.js HTTPS server and client to understand how certificates establish a trusted connection.

### Components

```text
mtls-poc/
|
+-- certs/
|   +-- ca.crt
|   +-- server.crt
|   +-- server.key
|   +-- client.crt
|   +-- client.key
|
+-- server/
|   +-- server.js
|
+-- client/
    +-- client.js
```

### Implementation

The server uses Node.js HTTPS with client certificate verification:

```javascript
https.createServer({
  key: serverKey,
  cert: serverCert,
  ca: caCert,
  requestCert: true,
  rejectUnauthorized: true
}, handler);
```

Important configuration:

- `requestCert: true` requests a client certificate.
- `rejectUnauthorized: true` rejects clients that do not present a certificate trusted by the configured CA.

### What I learned

- How to generate a private CA.
- How to generate server and client key pairs.
- How to create certificate signing requests.
- How a CA signs certificates.
- How the server verifies a client certificate.
- How TLS protects HTTP communication.

I also explored the client certificate identity and changed the client subject from `root-ms` to `mtls-client` in the basic POC.

---

# PART 4: SERVICE-TO-SERVICE mTLS

## 6. Node.js Microservice mTLS POC

### Objective

The objective was to secure communication between two internal microservices using mTLS.

Architecture:

```text
       Root Microservice
          root-ms
             |
             |
       HTTPS + mTLS
             |
             v
    Transaction Microservice
       transaction-ms
```

### Implementation

- Created a private CA.
- Generated separate server and client certificates.
- Configured the transaction service as an HTTPS server.
- Configured the root service as an HTTPS client.
- Enabled client certificate verification.
- Tested communication using Docker and Podman.

### Important configuration

Server:

```javascript
https.createServer({
  key: serverKey,
  cert: serverCert,
  ca: caCert,
  requestCert: true,
  rejectUnauthorized: true
}, handler);
```

Client:

```javascript
https.request({
  hostname: "transaction-ms",
  port: 8443,
  ca: caCert,
  cert: clientCert,
  key: clientKey,
  rejectUnauthorized: true
});
```

### Successful communication

The transaction service successfully verified the root service's client certificate.

The server observed the client certificate identity:

```text
CN=root-ms
```

This demonstrated that the client certificate was presented and its identity could be inspected after successful TLS authentication.

---

## 7. Kubernetes Service-to-Service mTLS

### Objective

I migrated the service-to-service mTLS POC into Kubernetes.

Namespace:

```text
mtls-services
```

Architecture:

```text
       Kubernetes Cluster
       Namespace: mtls-services

       Root Microservice
           root-ms
              |
              |
        HTTPS + mTLS
              |
              v
     Transaction Microservice
        transaction-ms
              |
              |
         ClusterIP Service
```

### Kubernetes components

| Component | Name |
|---|---|
| Namespace | mtls-services |
| Root deployment | root-ms |
| Transaction deployment | transaction-ms |
| Root certificate Secret | root-ms-certs |
| Transaction certificate Secret | transaction-ms-certs |
| Transaction service DNS | transaction-ms.mtls-services.svc.cluster.local |
| Transaction port | 8443 |

### Certificate mounting

Certificates were stored in Kubernetes Secrets and mounted into the application containers.

Example certificate paths:

```text
/certs/tls.crt
/certs/tls.key
/certs/ca.crt
```

### Communication flow

1. Root service resolves the transaction service using Kubernetes DNS.
2. Root service initiates an HTTPS connection.
3. Transaction service presents its server certificate.
4. Root service verifies the certificate using the trusted CA.
5. Root service presents its client certificate.
6. Transaction service verifies the root service certificate.
7. Secure communication is established.

### Successful test

The root service successfully called the transaction service through Kubernetes Service DNS.

The response confirmed:

```text
authenticatedClient=root-ms
```

TLS version observed:

```text
TLSv1.3
```

### Negative test

When the root service connected without a client certificate, the transaction service rejected the handshake.

Observed error:

```text
tlsv13 alert certificate required
```

This confirmed that client certificate authentication was mandatory.

---

# PART 5: DOCKER VS PODMAN mTLS COMPARISON

## 8. Runtime Comparison POC

### Objective

I compared Docker and Podman runtime behavior using the same service-to-service mTLS application.

Images:

```text
localhost/mtls-root-ms-podman:poc
localhost/mtls-transaction-ms-podman:poc
```

The POC tested the same application logic under both container runtimes.

### What I compared

- Container startup.
- Service communication.
- mTLS handshake.
- Request throughput.
- Response latency.
- Concurrent request handling.
- Failed requests.

### Load-test results

Evaluation: `evaluation-20261012-115437`

All 18 load-test trials completed with:

```text
HTTP 200: 10000
Failed:       0
```

Approximate throughput:

| Concurrency | Docker | Podman |
|---:|---:|---:|
| 100 | 505–539 req/s | 496–506 req/s |
| 200 | 534–542 req/s | 505–509 req/s |
| 500 | 497–527 req/s | 466–493 req/s |

### Learning outcome

Both runtimes successfully supported the mTLS application.

Docker showed somewhat higher throughput in these specific test runs. These results describe this POC environment and are not a general benchmark of Docker versus Podman.

---

# PART 6: APPLICATION-LAYER ENCRYPTION WITH mTLS

## 9. Banking Gateway Application-Layer Encryption POC

### Objective

I extended the banking gateway architecture by implementing both transport-level security and application-layer encryption.

The objective was to protect data not only while travelling over the network, but also through an additional encryption layer at the application level.

### Architecture

```text
        External Bank Client
                 |
                 |
              HTTPS
                 |
                 v
           API Gateway
                 |
                 |
          Internal mTLS
                 |
                 v
         Internal Service
                 |
                 |
        Decrypt Application
             Payload
```

### Components

```text
application-layer-encryption-poc/
|
+-- external-client/
|
+-- gateway/
|
+-- internal-service/
|
+-- tests/
|
+-- certs/
```

### Banking operations

The POC covered:

- Fund transfer.
- Balance enquiry.
- Refund.

### 9.1 Transport-level mTLS

External client → Gateway:

- Gateway requests the external client's certificate.
- Gateway validates the certificate against its trusted CA.
- Gateway checks the expected external client identity.

Gateway → Internal service:

- Gateway connects using its client certificate.
- Internal service verifies the gateway certificate.
- Internal service rejects clients that do not present the expected gateway identity.

### 9.2 Application-layer encryption

I implemented envelope encryption using:

**AES-256-GCM**
- Encrypts the actual banking payload.
- Provides confidentiality and authenticated integrity.
- Uses a unique nonce for each encryption operation.
- Produces an authentication tag used during decryption.

**RSA-OAEP**
- Encrypts the AES key using the recipient's public key.
- Allows the internal service to recover the AES key using its private key.

### Encryption flow

```text
External Client
      |
      | Create banking payload
      |
      v
 Generate AES-256-GCM Key
      |
      | Encrypt payload
      |
      v
 Encrypt AES Key using
 Internal Service Public Key
      |
      v
 Send Encrypted Envelope
      |
      v
     Gateway
      |
      | Validate client mTLS
      | Forward encrypted payload
      |
      v
 Internal Service
      |
      | Validate gateway mTLS
      | Decrypt AES key using RSA private key
      | Decrypt payload using AES-256-GCM
      |
      v
 Process Banking Operation
```

### 9.3 Replay protection

The internal service used a replay-tracking Map with a five-minute retention period.

This was used to reject previously received encrypted requests.

### 9.4 Kubernetes deployment

Namespace:

```text
application-layer-encryption
```

Deployments:

```text
gateway
internal-service
```

Services:

```text
gateway:8443
internal-service:9443
```

Secrets:

```text
gateway-certs
internal-certs
```

Certificates and encryption keys were mounted under:

```text
/app/certs
```

### 9.5 Security tests performed

| Scenario | Expected result | Observed result |
|---|---|---|
| Valid encrypted request | Process request | Passed |
| Invalid route | HTTP 404 | Passed |
| Malformed encrypted envelope | HTTP 400 | Passed |
| Negative transfer amount | HTTP 400 | Passed |
| Replayed encrypted request | HTTP 409 | Passed |
| Tampered encrypted payload | Reject decryption | Passed |
| Internal service called without gateway certificate | Reject request | Passed |
| Gateway called using internal-service identity instead of external-client identity | Reject request | Passed |

Additional observations:

- The external client certificate was accepted by the gateway in the successful test.
- The gateway-client certificate was rejected when presented as an external client identity.
- The external-client certificate was rejected when used to access the internal service.
- The external no-client-certificate scenario and some untrusted-client scenarios were not fully confirmed in the recorded test results.

### Learning outcome

I learned that mTLS and application-layer encryption solve different security problems.

mTLS protects communication and authenticates the connected services.

Application-layer encryption protects sensitive payload contents through an additional encryption and decryption process.

---

# PART 7: CERTIFICATE LIFECYCLE MANAGEMENT

## 10. Why Certificate Renewal Is Needed

Certificates have an expiration date.

If a certificate expires:
- Clients may reject the server certificate.
- Servers may reject expired client certificates.
- Secure service-to-service communication can fail.

Manually replacing certificates across multiple services becomes difficult.

Therefore, I explored automated certificate issuance and renewal.

### Certificate lifecycle

```text
       Generate Private Key
               |
               v
       Create Certificate
         Signing Request
               |
               v
       Certificate Issuance
               |
               v
       Deploy Certificate
               |
               v
       Monitor Expiration
               |
               v
       Automatic Renewal
               |
               v
       Update Kubernetes Secret
               |
               v
       Reload Application
```

---

## 11. Vault PKI + cert-manager POC

### Objective

The objective was to use HashiCorp Vault as a private Certificate Authority and cert-manager to automate certificate issuance and renewal inside Kubernetes.

### Architecture

```text
             Vault
          Private PKI CA
                |
                |
         Vault PKI API
                |
                v
           cert-manager
                |
                v
          Vault Issuer
                |
         ----------------
         |              |
         v              v
      root-ms      transaction-ms
     Certificate     Certificate
         |              |
         v              v
     Kubernetes TLS Secrets
```

### Components

| Component | Purpose |
|---|---|
| Vault | Private CA and certificate issuer |
| Vault PKI engine | Signs certificates |
| PKI role | Defines certificate issuance rules |
| Vault policy | Controls PKI API permissions |
| Vault token | Authenticates cert-manager to Vault |
| cert-manager | Automates certificate lifecycle |
| Vault Issuer | Connects cert-manager to Vault |
| Certificate | Requests and tracks certificates |
| Kubernetes Secret | Stores issued certificate and private key |

### 11.1 Vault PKI

I explored:

- Enabling the PKI secrets engine.
- Creating a private CA.
- Configuring the PKI signing role.
- Defining certificate TTL and maximum TTL.
- Creating a Vault policy.
- Creating a Vault token with the required signing permissions.

The certificate signing endpoint used in the POC was:

```text
pki/sign/mtls-services
```

### 11.2 cert-manager integration

cert-manager watches Kubernetes Certificate resources.

When a certificate needs to be issued or renewed, cert-manager creates a CertificateRequest and communicates with the configured issuer.

Example certificate configuration:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: root-ms-certificate
  namespace: mtls-services
spec:
  secretName: root-ms-certs
  issuerRef:
    name: vault-issuer
    kind: Issuer
  renewBefore: 20m
```

### 11.3 Automatic renewal

The renewal flow:

1. cert-manager monitors certificate validity.
2. It checks the `renewBefore` setting.
3. When the renewal window is reached, it creates a new CertificateRequest.
4. Vault signs a replacement certificate.
5. cert-manager updates the Kubernetes TLS Secret.
6. The application must reload or restart to use the new certificate.

The POC used Stakater Reloader annotations to trigger workload restarts when certificate Secrets changed.

### 11.4 What I learned about Vault sealing

Vault can be sealed to prevent access to protected secrets and cryptographic operations.

When Vault is sealed:
- Requests to protected secrets-engine endpoints cannot be served.
- Certificate issuance through the PKI engine stops.
- Vault must be unsealed before normal operations can resume.

I explored Shamir unseal shares and thresholds.

I also encountered Vault state differences between configurations, including a later in-memory Vault instance and a previous file-storage setup. These are separate configurations and should not be treated as one persistent Vault deployment.

### 11.5 Renewal and troubleshooting observations

I encountered:
- `invalid token`.
- `permission denied`.
- Issuer authentication failures.
- CertificateRequest failures.
- Vault sealed state after restart.

I recreated the issuer token Secret and investigated the Vault policy and PKI signing permissions.

The POC also demonstrated certificate renewal and serial-number/date checks in the cert-manager workflow.

**Important:** A successful certificate renewal after correcting a token or issuer problem is not the same as proving uninterrupted, unattended renewal across a Vault restart. Those scenarios must be distinguished.

---

# PART 8: CERTBOT AND ACME

## 12. Certbot Automatic Certificate Renewal POC

### Objective

I explored Certbot to understand how ACME-based certificate issuance and automatic renewal work.

Certbot is an ACME client commonly used to obtain and renew certificates from Let's Encrypt.

### ACME flow

```text
          Certbot
             |
             | Request certificate
             v
         ACME Server
             |
             | Challenge
             v
       Domain Validation
             |
             | Validation successful
             v
       Certificate Issued
             |
             v
       Install Certificate
             |
             v
       Automatic Renewal
```

### 12.1 Pebble

I used Pebble as a local ACME test server.

Pebble allows ACME issuance and renewal workflows to be tested without depending on the production Let's Encrypt service.

### 12.2 Components

- Certbot.
- Pebble ACME server.
- challtestsrv for ACME challenge testing.
- Local certificate configuration and storage directories.

### 12.3 What I learned

- Certbot requests certificates through the ACME protocol.
- ACME servers validate domain control through challenges.
- A successful challenge allows the server to issue a certificate.
- Certbot can renew certificates before expiration.
- Custom Certbot configuration directories must be used consistently when inspecting issued certificates.

### 12.4 Certificate verification

I inspected certificate details using OpenSSL:

```bash
openssl x509 -in certificate.crt -noout \
  -subject -issuer -dates -ext extendedKeyUsage
```

The issued Pebble certificate showed:
- Pebble Intermediate CA as issuer.
- TLS Web Server Authentication as EKU.
- A defined certificate validity period.

### 12.5 Certbot and mTLS

Certbot/Let's Encrypt primarily provides publicly trusted server certificates.

For a private service-to-service mTLS setup, client identity certificates still need an appropriate client certificate issuer.

In the POC, the Certbot-issued server certificate and a separately generated client certificate were used to explore this combination.

Pebble's test certificate issuance was observed to provide serverAuth; a separate client certificate was used for mTLS.

---

# PART 9: TLS/mTLS SECURITY TESTING

## 13. Certificate Validation Scenarios

I explored the following negative and positive test cases across the TLS/mTLS POCs.

| Scenario | What it checks |
|---|---|
| Valid certificate | Trusted certificate is accepted |
| Missing client certificate | Client authentication is enforced |
| Untrusted CA | Certificate chain validation |
| Expired certificate | Validity-period verification |
| Not-yet-valid certificate | Certificate start-date verification |
| Wrong client identity | Application identity authorization |
| Wrong server hostname | SAN/hostname verification |
| Key mismatch | Certificate and private-key consistency |
| Bad CA | Trust-chain rejection |

### 13.1 Why these tests matter

A successful TLS handshake alone does not prove every security requirement is satisfied.

For example:
- A certificate may be signed by a trusted CA but contain the wrong identity.
- A server certificate may be valid but not match the hostname.
- A certificate may be expired.
- A client may be trusted cryptographically but not authorized by the application.

Therefore, certificate trust, hostname validation, certificate validity, and application identity checks must be tested separately.

---

# PART 10: IMPORTANT COMMANDS AND VERIFICATION

## 14. OpenSSL Commands

Inspect certificate information:

```bash
openssl x509 -in certificate.crt -noout -text
```

Check subject, issuer, and validity:

```bash
openssl x509 -in certificate.crt -noout \
  -subject -issuer -dates
```

Check SAN:

```bash
openssl x509 -in certificate.crt -noout -ext subjectAltName
```

Check EKU:

```bash
openssl x509 -in certificate.crt -noout -ext extendedKeyUsage
```

Verify certificate against CA:

```bash
openssl verify -CAfile ca.crt certificate.crt
```

Compare certificate and private-key public-key hashes:

```bash
openssl x509 -in certificate.crt -pubkey -noout |
  openssl pkey -pubin -outform DER |
  openssl dgst -sha256

openssl pkey -in private.key -pubout -outform DER |
  openssl dgst -sha256
```

The hashes should match.

## 15. Kubernetes Certificate Commands

List certificates:

```bash
kubectl get certificates -n mtls-services
```

Watch certificate issuance:

```bash
kubectl get certificates -n mtls-services -w
```

Inspect certificate details:

```bash
kubectl describe certificate root-ms-certificate -n mtls-services
```

Inspect CertificateRequests:

```bash
kubectl get certificaterequests -n mtls-services
```

Inspect issuer:

```bash
kubectl describe issuer vault-issuer -n mtls-services
```

Inspect certificate Secret:

```bash
kubectl get secret root-ms-certs -n mtls-services
```

Inspect certificate serial number and validity:

```bash
kubectl get secret root-ms-certs -n mtls-services \
  -o jsonpath='{.data.tls\.crt}' |
  base64 -d |
  openssl x509 -noout -serial -dates -fingerprint -sha256
```

Check cert-manager logs:

```bash
kubectl logs deployment/cert-manager -n cert-manager --tail=100
```

---

# PART 11: FINAL LEARNING OUTCOME

## 16. What I Learned

Through these POCs, I learned how TLS establishes encrypted communication and how mTLS adds mutual certificate-based authentication between applications.

I created private CAs, generated server and client certificates, configured certificate chains, SANs, EKUs, and implemented positive and negative certificate validation tests.

I implemented service-to-service mTLS using Node.js HTTPS, Docker, Podman, and Kubernetes. I verified secure communication through Kubernetes Service DNS and tested missing-client-certificate rejection.

I then extended the banking gateway POC by combining mTLS with application-layer encryption using AES-256-GCM and RSA-OAEP. I also explored replay protection, identity validation, tamper detection, and Kubernetes Secret management.

Finally, I explored certificate lifecycle automation using Vault PKI, cert-manager, Certbot, and Pebble. I learned how certificate issuance, renewal windows, Kubernetes Secret updates, Vault authentication, and Vault sealing affect certificate management.

## 17. Key Concepts Summary

| Concept | What I learned |
|---|---|
| TLS | Encrypted and authenticated communication |
| mTLS | Mutual certificate-based authentication |
| CA | Trusted certificate issuer |
| CSR | Request for a signed certificate |
| SAN | Valid server DNS/IP identities |
| EKU | Certificate usage restrictions |
| Certificate chain | Trust from leaf certificate to CA |
| Certificate expiry | Why renewal is required |
| Vault PKI | Private certificate issuance |
| cert-manager | Kubernetes certificate lifecycle automation |
| Certbot | ACME certificate issuance and renewal |
| Pebble | Local ACME testing |
| AES-256-GCM | Authenticated payload encryption |
| RSA-OAEP | Encryption of the AES key |
| Replay protection | Detection of previously received requests |
| Kubernetes Secrets | Storage and distribution of certificate material |

## 18. Overall Conclusion

TLS and mTLS provide the foundation for securing communication between applications and microservices. Through practical implementation, I understood the TLS handshake, certificate trust validation, mutual authentication, and the importance of certificate identity and expiry management.

The POCs progressed from basic Node.js TLS/mTLS communication to containerized service-to-service communication, Kubernetes deployments, and banking gateway application-layer encryption. I also explored automating certificate issuance and renewal using Vault, cert-manager, and Certbot.

The key learning was that secure microservice communication requires more than enabling TLS. It requires correct certificate issuance, trust-chain validation, hostname and identity verification, certificate lifecycle management, application authorization, and continuous security testing.