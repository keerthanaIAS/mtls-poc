Yes, we have completed the Vault + cert-manager certificate issuance/renewal setup and successfully tested the API using the Vault-issued certificates. One important distinction: automatic renewal by cert-manager is working, but automatically copying every future renewal into our runtime Secrets and reloading the running Node.js services is not yet completed. The API test passed with the certificates currently installed.

Here is the full flow we implemented, including the YAML resources, durations, monitoring, and gateway-to-internal-service verification.

# 1. Overall architecture

cert-manager
Monitors Certificate resources and renewal times
        |
Requests a certificate or renewal

Vault PKI issuer
Checks the configured PKI role and signs the certificate
        |
Returns the signed certificate

cert-manager-managed Kubernetes Secrets
Store the issued certificate and private key
        |
Current certificates copied to runtime Secrets; workloads restarted

Gateway ↔ Internal service
Use the installed certificates for mutual TLS (mTLS)

The important distinction is that cert-manager manages certificate issuance and renewal; Vault acts as the internal CA that signs the certificates. Vault does not independently monitor the Kubernetes Certificate resources.

# 2. How cert-manager requests renewal from Vault

We are using Kubernetes YAML resources, not a custom script that calculates expiration dates and directly renews certificates.

There are three important resource types.

## A. `Issuer` — how cert-manager contacts Vault

Our `vault-pki` Issuer is configured to use the Vault PKI signing endpoint:

- Vault service: `vault.vault.svc:8200`
- PKI signing path: `pki/sign/application-layer-encryption`
- Authentication: token stored in the Kubernetes Secret `vault-issuer-token`

Conceptually, the relevant configuration is:

```
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: vault-pki
  namespace: application-layer-encryption
spec:
  vault:
    server: http://vault.vault.svc:8200
    path: pki/sign/application-layer-encryption
    auth:
      tokenSecretRef:
        name: vault-issuer-token
        key: token
```

This illustrates the connection we configured; the actual resource in the cluster is authoritative.

What this does: it tells cert-manager where to send signing requests and how to authenticate to Vault. It does not set the renewal interval.

## B. `Certificate` — the certificate lifetime and renewal policy

We created these primary Certificate resources:

- `gateway-tls`
- `gateway-client-tls`
- `internal-service-tls`

Their important settings are:

```
spec:
  duration: 24h
  renewBefore: 7h
  issuerRef:
    name: vault-pki
    kind: Issuer
```

These are the actual duration settings we used for the three primary certificates.

The meaning is:

| Setting                | Value                | Meaning                                         |
| ---------------------- | -------------------- | ----------------------------------------------- |
| `duration`             | 24 hours             | Requested certificate lifetime                  |
| `renewBefore`          | 7 hours              | Start renewal when approximately 7 hours remain |
| Expected renewal point | After about 17 hours | 24h − 7h                                        |
| Issuer                 | `vault-pki`          | Vault signs the replacement certificate         |

The primary certificates had a `NotAfter` time of `2026-10-24 05:49:21 UTC` and a scheduled `renewalTime` of `2026-10-23 22:49:21 UTC` in the last output we checked.

The renewal is scheduled based on the certificate's actual lifetime and cert-manager's renewal policy; it is not a script running a hard-coded 17-hour sleep.

## C. `CertificateRequest` — the individual issuance request

When cert-manager needs a new certificate, it creates a `CertificateRequest`, for example:

- `gateway-tls-2`
- `gateway-client-tls-2`
- `internal-service-tls-2`

The `-2` suffix indicates revision 2 for those certificates.

The flow is:

1. cert-manager observes that a certificate needs issuance or renewal.
2. It creates a `CertificateRequest`.
3. The `vault-pki` Issuer sends the signing request to Vault.
4. Vault checks its PKI role and signs the certificate.
5. cert-manager receives the result and updates the managed Kubernetes Secret.
6. cert-manager records the certificate revision and renewal status.

The successful revision-2 CertificateRequests and the renewal events we inspected are evidence that this issuance flow has already run.

# 3. What duration did we use for the fast-renewal test?

We also created two test certificates to demonstrate renewal more quickly than waiting for a full day.

| Certificate                     | Duration | `renewBefore` | Approximate renewal point |
| ------------------------------- | -------- | ------------- | ------------------------- |
| `vault-issuance-test`           | 5 hours  | 1 hour        | After about 4 hours       |
| `vault-issuance-fast-renewal`   | 1 hour   | 5 minutes     | After about 55 minutes    |
| Three main service certificates | 24 hours | 7 hours       | After about 17 hours      |

The fast-renewal certificate reached revision 4 in the last status output. That demonstrates multiple issuance revisions. The main certificates also reached revision 2, with successful renewal/issuance events recorded.

The fast-renewal certificate is a testing aid. It is not the certificate that the gateway and internal service use for their main application traffic.

# 4. How are we monitoring renewal?

We used Kubernetes status and events rather than a custom monitoring script.

These commands show the important information:

```
NS=application-layer-encryption

kubectl get certificates -n "$NS"
kubectl get certificaterequests -n "$NS"
kubectl describe certificate gateway-tls -n "$NS"
kubectl describe issuer vault-pki -n "$NS"
```

For a compact view of renewal scheduling and revision numbers:

```
kubectl get certificates -n "$NS" \
  -o custom-columns='NAME:.metadata.name,READY:.status.conditions[-1].status,REVISION:.status.revision,RENEWAL:.status.renewalTime'
```

What we check:

- `Ready=True` — cert-manager considers the certificate ready.
- `REVISION` — which issued version is currently represented.
- `RENEWAL` — when cert-manager schedules renewal.
- CertificateRequest status — whether the issuance request succeeded.
- Events — whether renewal was scheduled, a request was created, or issuance failed.
- Issuer status — whether cert-manager can use the Vault issuer.

`Ready=True` by itself does not prove a renewal occurred. To confirm renewal, we compare revisions and inspect the corresponding CertificateRequest and events.

# 5. How does gateway-to-internal-service mTLS verification work?

Our application uses certificates for both sides of the internal connection.

Gateway — mTLS client
Uses `gateway-client.crt` and `gateway-client.key` to identify itself.
        ||
TLS handshake
Both sides verify the peer's certificate

Internal service — mTLS server
Uses `internal.crt` and `internal.key` to identify itself, and validates the gateway's client certificate.

The detailed verification process is:

1. Gateway connects to the internal service. The gateway uses the internal service's Kubernetes Service DNS name, with TLS certificate verification enabled.
2. Internal service presents its server certificate. The gateway checks the certificate chain against its configured trusted CA bundle and validates the hostname against the certificate SAN.
3. Gateway presents its client certificate. The internal service requests a client certificate and verifies it against its configured CA.
4. Application identity checks run. Our Node.js code checks the peer certificate identity, including the expected gateway identity.
5. The connection proceeds only if verification succeeds. The configured `rejectUnauthorized: true` and server-side `requestCert: true`/`rejectUnauthorized: true` settings enforce certificate validation.

That establishes mutual authentication: the gateway verifies the internal service, and the internal service verifies the gateway.

## How does this relate to Vault?

Vault signed the internal certificates using the internal CA. The certificates therefore establish a chain of trust to that CA, which the services must trust.

Vault does not participate in every TLS handshake. Once the certificates are issued and installed, the gateway and internal service validate one another locally using their certificates and trusted CA certificates.

# 6. What did our API test prove?

We ran `tests/security-suite.js` against the gateway after installing the Vault-issued certificates in the runtime Secrets and rolling out both deployments.

All five checks passed:

- Invalid route → HTTP 404
- Malformed encrypted envelope → HTTP 400
- Invalid negative amount → HTTP 400
- First request with a unique ID → HTTP 200
- Replay of the same encrypted request → HTTP 409

This confirms that the application security suite worked with the certificates currently installed. The payload encryption and replay protection checks are application-layer controls, separate from the mTLS handshake.

# 7. One remaining distinction: certificate renewal versus runtime rotation

The cert-manager-managed Secrets are the source of truth for the renewed certificates. We copied their current certificate data into `gateway-vault-runtime` and `internal-vault-runtime` so the existing application file paths would continue working without changing the Node.js code.

Those copies are not yet automatically synchronized after a future renewal. Also, our Node.js TLS servers load certificate files when they start, so they need a reload or restart to begin using replacement certificates.

Therefore, the accurate status is:

- &#x20;Vault PKI issuer and cert-manager Certificate resources configured.
- &#x20;Renewal scheduling and successful issuance revisions observed.
- &#x20;Vault-issued certificates installed in both workloads.
- &#x20;API security suite passed with those certificates.
- &#x20;Automatic synchronization of future renewed certificates into the runtime Secrets, followed by workload reload/restart, still needs to be implemented and verified.

So we have the automated renewal mechanism in cert-manager and Vault, and the API test passed. We should not yet describe the entire renewal-to-live-runtime process as fully automatic until that final synchronization and reload step is handled.


*this also auto renewal right u changed the dureation to 1 hr after the duration renewbefore 5 mins the certificate reissue and working right here what u confusing*?
Yes — you are right. We did configure and test automatic certificate renewal. I was confusing that with the separate runtime synchronization issue. Sorry.

Here is exactly what we did:

1. Created `vault-issuance-fast-renewal` using the Kubernetes Certificate YAML.
2. Set `duration: 1h` and `renewBefore: 5m`.
3. cert-manager automatically monitored the certificate's renewal time.
4. When renewal was due, cert-manager requested a replacement certificate from Vault.
5. Vault signed the replacement, and cert-manager stored it in the managed Secret.
6. We observed revision 4 and a successful CertificateRequest, confirming repeated issuance.

The expected renewal point is approximately 55 minutes after issuance, leaving five minutes before expiry.

So yes: automatic renewal through cert-manager and Vault is working in our POC. We did not need to run a script manually to request each renewal.

The only separate limitation is that the application runtime uses copied Secrets, so automatic propagation of future renewed certificates into those Secrets—and reloading the running services—has not been implemented. That does not mean the certificate renewal itself is broken.

*in vault-test-certificate yaml file i cn see this where is 1h and vault-issuance-fast-renewal file?:*
The YAML you are looking at is `vault-test-certificate.yaml`, which defines `vault-issuance-test`. It is the 5-hour test certificate, not the fast-renewal certificate.

You have two separate test certificates:

| Certificate                   | YAML duration | `renewBefore` | Approximate renewal point |
| ----------------------------- | ------------- | ------------- | ------------------------- |
| `vault-issuance-test`         | `5h`          | `1h`          | After about 4 hours       |
| `vault-issuance-fast-renewal` | `1h`          | `5m`          | After about 55 minutes    |

Both use the `vault-pki` Issuer. The `1h` setting you are asking about belongs to the second certificate's YAML file.

There is no separate `vault-issuance-fast-renewal.yaml` file recorded in our earlier steps. We created the fast-renewal Certificate directly using an inline command in your `application-layer-encryption-poc` directory.

The existing file you found:

`k8s/vault-test-certificate.yaml`

defines `vault-issuance-test` with `duration: 5h` and `renewBefore: 1h`.

The fast-renewal certificate was created separately with an *inline command equivalent to*:
```
kubectl get certificate vault-issuance-test \
  -n application-layer-encryption -o json |
jq '...'
```

The command modified the Certificate definition to use:
```
metadata:
  name: vault-issuance-fast-renewal
spec:
  secretName: vault-issuance-fast-renewal-tls
  duration: 1h
  renewBefore: 5m
```

It was then applied to Kubernetes, creating the resource. That means the fast-renewal configuration exists in the Kubernetes cluster, but it wasn't saved as a separate YAML file in your project.

You can inspect the actual live configuration with:
```
kubectl get certificate vault-issuance-fast-renewal \
  -n application-layer-encryption -o yaml
```

This shows the configuration Kubernetes is using, including the one-hour duration and five-minute renewal window.

*Summary*:
Here is what we actually did:
1. Resolved the Vault dev-mode and PKI issuance problems.
2. Got the Issuer and main certificates to Ready=True.
3. Reduced the test certificate lifetime to 1 hour, with renewal scheduled 5 minutes before expiry.
4. Observed successful certificate issuance and revision 4 for vault-issuance-fast-renewal.
5. Installed Vault-issued certificates into the gateway and internal-service runtime Secrets and restarted both deployments.
6. Ran the API security suite, and all five checks passed.
The precise conclusion: automatic certificate renewal through cert-manager and Vault is working, and API communication using the installed Vault-issued certificates passed.

