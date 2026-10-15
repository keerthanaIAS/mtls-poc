# The flow will be:
Certbot (ACME client)
       |
       | Requests certificate
       v
Pebble (test ACME server / CA)
       |
       | Issues certificate
       v
root-ms  -------- mTLS -------->  transaction-ms
             certificate checks

* One important distinction: Pebble is a local test CA, not a production CA. We’ll validate what certificate types it issues before claiming the issued certificates support client authentication.

* Certbot 5.8.0 and Docker are installed.

* Your setup is ready. We’ll build the new POC entirely inside:
~/Desktop/mtls-poc/certbot
You already have Certbot 5.8.0, Docker, and the Pebble image.

* The failure is from two configuration issues, not Certbot installation:
1. challtestsrv did not appear in docker compose ps, so the HTTP-01 hook couldn’t connect to port 8055.
2. Pebble tried to resolve transaction-ms.test from inside its container, but that hostname wasn’t resolvable there.
Also, the certificate was not issued. The openssl command failed because macOS’s OpenSSL version doesn’t support the -ext option used in that form.

* The logs show Pebble and challtestsrv are running. The current failure is Account ... not found because restarting Pebble resets its in-memory ACME accounts, while Certbot still remembers the previous account URL.

* The failure is now clear: Certbot successfully registered the HTTP-01 challenge, but Pebble tried to validate transaction-ms.test at 127.0.0.1:5002 (::1:5002) and the connection was refused. No certificate has been issued yet.
The problem is that Pebble’s challenge request is resolving to localhost instead of reaching the challenge server inside Docker. We need to fix the test DNS configuration, not reinstall Certbot.

* Your certificate inspection confirms one important limitation for the mTLS POC:
- Issuer: Pebble Intermediate CA
- Domain: transaction-ms.test
- Validity: October 15–21, 2026
- Key algorithm: ECDSA P-256
- Extended Key Usage: TLS Web Server Authentication only
- Client Authentication: Not present

* The -ext error happens because your Mac’s built-in LibreSSL does not support that option. Earlier, your full certificate output already confirmed TLS Web Server Authentication and DNS:transaction-ms.test.

* Current POC status
- Certbot successfully obtained a certificate from Pebble.
- Certificate/private-key match: PASS
- Server authentication: PASS
- Client authentication: not included in this certificate

* Pebble Root CA certificate saved and verified — PASS.
- Subject: CN=Pebble Root CA 6238cf
- Issuer: Same as subject, confirming it is a self-signed root certificate.
- Validity: October 15, 2026 – October 15, 2056.
- File: certs/pebble-root-ca.pem
Next step: create a client certificate for root-ms

* The server certificate is already issued, and the Pebble root CA is saved. One key detail: Pebble's default and shortlived profiles control certificate lifetime; they don't prove that ACME-issued certificates include client authentication. We'll create a dedicated client certificate with the correct usage, then test real mTLS connections.

* Important distinction for your POC report:
- Certbot + Pebble: issued the transaction-ms server certificate.
- OpenSSL: created the separate root-ms client certificate with client-authentication usage.
- Node.js HTTPS: enforces mutual certificate authentication.
- Not yet tested: production certificate automation, renewal, Kubernetes deployment, and load performance.

| Test                         | Result          | What it proves                                               |
| ---------------------------- | --------------- | ------------------------------------------------------------ |
| Valid client certificate     | PASS — HTTP 200 | `root-ms` authenticated successfully by `transaction-ms`.    |
| No client certificate        | PASS — rejected | The server requires a client certificate.                    |
| Untrusted client certificate | PASS — rejected | A certificate signed by an untrusted CA cannot authenticate. |

### Important distinction about certificate issuance

- Certbot + Pebble: Issued the `transaction-ms` server certificate.
- OpenSSL: Created the test CA and `root-ms` client certificate.
- Node.js HTTPS: Enforces mutual TLS authentication between the two services.

So this POC demonstrates a Certbot-issued server certificate and mTLS authentication, but it does not yet demonstrate Certbot issuing the client certificate.

Next, we can test certificate validation failures and certificate expiry, then run load tests to measure throughput and latency.

Your tests passed. The hostname validation and load tests are successful. One issue: `-ext subjectAltName` isn't supported by your Mac's LibreSSL, so use `-text` instead.

## Final results

| Test                             | Result                      |
| -------------------------------- | --------------------------- |
| Valid mTLS client certificate    | PASS — HTTP 200             |
| Missing client certificate       | PASS — rejected             |
| Untrusted client certificate     | PASS — rejected             |
| Wrong server hostname            | PASS — rejected             |
| 1,000 requests, concurrency 20   | 5,347.59 req/s; 0 failures  |
| 5,000 requests, concurrency 50   | 9,208.10 req/s; 0 failures  |
| 10,000 requests, concurrency 100 | 10,460.25 req/s; 0 failures |

## Load-test summary

| Metric          | 1,000 requests | 5,000 requests | 10,000 requests |
| --------------- | -------------- | -------------- | --------------- |
| Throughput      | 5,347.59 req/s | 9,208.10 req/s | 10,460.25 req/s |
| Average latency | 3.02 ms        | 4.92 ms        | 8.82 ms         |
| p50 latency     | 2 ms           | 3 ms           | 6 ms            |
| p95 latency     | 4 ms           | 7 ms           | 10 ms           |
| p99 latency     | 51 ms          | 45 ms          | 71 ms           |
| Failures        | 0              | 0              | 0               |

These are local POC results, not production capacity figures. The test uses localhost, a simple Node.js handler, and persistent HTTPS connections. It doesn't measure CPU/memory or compare against Docker, and the results aren't a direct measure of certificate issuance speed.

## Fix the certificate inspection command

Next important step: capture CPU and memory during load, and run the same workload against a comparable baseline if you want to quantify overhead. Also remember that Certbot issued the server certificate; OpenSSL issued the client certificate.

* Certificate inspection is confirmed. The `transaction-ms` server certificate is valid and has the expected hostname.

- Issuer: Pebble Intermediate CA
- Subject: Empty — acceptable because the SAN identifies the server.
- SAN: `DNS:transaction-ms.test` — correct.
- Validity: October 15–21, 2026.
- Public-key algorithm: ECDSA.
- Signature algorithm: ECDSA with SHA-256.

Your mTLS security tests and all three load tests also passed.

Next: capture CPU and memory usage during load, then compare Docker and Podman only if you want to evaluate runtime overhead. For this Certbot POC, the remaining key limitation is that the client certificate was created with OpenSSL, not Certbot.

