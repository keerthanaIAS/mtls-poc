# Local Vault + cert-manager mTLS Certificate Issuance and Auto-Renewal POC

This README records the local Kubernetes steps for the `mtls-services`
POC: configure Vault PKI, create the correct signing policy and token,
connect cert-manager to Vault, issue certificates, and observe automatic
renewal.

> **Important:** This POC used Vault dev mode with in-memory storage.
> Restarting Vault can erase its PKI configuration, policies, and
> tokens. Never commit real Vault tokens or private keys to Git.

## 1. Environment and names

-   Vault namespace/pod: `vault` / `vault-0`
-   Application namespace: `mtls-services`
-   Vault Service DNS: `vault.vault.svc.cluster.local:8200`
-   PKI mount: `pki/`
-   Signing role: `mtls-services`
-   Vault policy: `mtls-signing`
-   Kubernetes token Secret: `vault-issuer-token`, key `token`
-   cert-manager Issuer: `vault-issuer`
-   Certificate `root-ms-certificate` writes Secret `root-ms-tls`
-   Certificate `transaction-ms-certificate` writes Secret
    `transaction-ms-tls`
-   Leaf certificate duration: `1h`
-   Renewal lead time: `20m`

## 2. Check the cluster

Run from your local project terminal:

``` bash
kubectl get pods -n vault
kubectl get pods -n mtls-services
kubectl get crd certificates.cert-manager.io
```

If the namespaces do not exist, create them. Do not recreate existing
namespaces with POC resources.

``` bash
kubectl create namespace vault
kubectl create namespace mtls-services
```

## 3. Open Vault and authenticate

Open a shell in the Vault pod:

``` bash
kubectl exec -it -n vault vault-0 -- sh
```

Inside the Vault pod:

``` sh
export VAULT_ADDR=http://127.0.0.1:8200
vault status
```

Authenticate using the **current Vault dev root token** for this running
Vault instance. If needed, inspect the startup logs from another local
terminal:

``` bash
kubectl logs -n vault vault-0 | grep -i -E 'root token|root_token'
```

Inside the Vault shell, set the current token without saving it in the
README:

``` sh
export VAULT_TOKEN='<CURRENT_VAULT_DEV_ROOT_TOKEN>'
vault token lookup
```

Continue only if `vault token lookup` succeeds. A token from an earlier
dev-mode Vault instance may no longer work after a restart.

## 4. Configure Vault PKI and signing role

Run these commands inside the authenticated Vault shell.

Enable the PKI mount:

``` sh
vault secrets enable -path=pki pki
```

If Vault reports that `pki/` is already in use, do not enable it again.

``` sh
vault secrets tune -max-lease-ttl=8760h pki
```

Create the root CA **only if this is a fresh PKI setup and no existing
CA should be preserved**:

``` sh
vault write pki/root/generate/internal \
  common_name="Local MTLS Test CA" \
  ttl=8760h
```

**Do not regenerate the root CA during routine renewal.** A new CA
changes the trust anchor and may break existing certificate trust.

Create/update the signing role:

``` sh
vault write pki/roles/mtls-services \
  allowed_domains="mtls-services.svc.cluster.local" \
  allow_subdomains=true \
  allow_bare_domains=true \
  allow_localhost=true \
  key_type=ec \
  key_bits=256 \
  server_flag=true \
  client_flag=true \
  max_ttl=1h
```

Verify:

``` sh
vault secrets list
vault read pki/roles/mtls-services
```

## 5. Create the correct policy and token

The policy must allow the Issuer's exact signing path:
`pki/sign/mtls-services`.

Inside the authenticated Vault shell:

``` sh
vault policy write mtls-signing - <<'HCL'
path "pki/sign/mtls-services" {
  capabilities = ["update"]
}
HCL
```

Create a token for cert-manager using that policy:

``` sh
vault token create -field=token -policy=mtls-signing -ttl=720h
```

Copy the output temporarily; do not put the token in this README or
source control. Exit the Vault shell:

``` sh
exit
```

## 6. Store the token in Kubernetes

Back in the local terminal, paste the token securely into a hidden
prompt:

``` bash
read -s -p "Paste the Vault mtls-signing token: " VAULT_TOKEN
echo
```

Create or update the Secret using the exact key `token`:

``` bash
kubectl create secret generic vault-issuer-token \
  -n mtls-services \
  --from-literal=token="$VAULT_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

unset VAULT_TOKEN
```

Verify the Secret name and key without displaying the token:

``` bash
kubectl get secret vault-issuer-token -n mtls-services \
  -o go-template='{{.metadata.name}}{{"\n"}}{{range $k, $v := .data}}{{$k}}{{"\n"}}{{end}}'
```

Expected key: `token`.

## 7. Configure cert-manager Issuer

Save this as `vault-issuer.yaml` in your project directory:

``` yaml
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: vault-issuer
  namespace: mtls-services
spec:
  vault:
    server: http://vault.vault.svc.cluster.local:8200
    path: pki/sign/mtls-services
    auth:
      tokenSecretRef:
        name: vault-issuer-token
        key: token
```

Apply and inspect:

``` bash
kubectl apply -f vault-issuer.yaml
kubectl get issuer vault-issuer -n mtls-services
kubectl describe issuer vault-issuer -n mtls-services
```

`Ready=True` is useful, but check current CertificateRequests and events
too when debugging; a stale Ready condition alone does not prove a new
signing request succeeds.

## 8. Configure the certificates

Save as `vault-certificates.yaml`:

``` yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: root-ms-certificate
  namespace: mtls-services
spec:
  secretName: root-ms-tls
  issuerRef:
    name: vault-issuer
    kind: Issuer
  duration: 1h
  renewBefore: 20m
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always
  dnsNames:
    - root-ms.mtls-services.svc.cluster.local
  usages:
    - digital signature
    - server auth
    - client auth
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: transaction-ms-certificate
  namespace: mtls-services
spec:
  secretName: transaction-ms-tls
  issuerRef:
    name: vault-issuer
    kind: Issuer
  duration: 1h
  renewBefore: 20m
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always
  dnsNames:
    - transaction-ms.mtls-services.svc.cluster.local
  usages:
    - digital signature
    - server auth
    - client auth
```

Apply and check:

``` bash
kubectl apply -f vault-certificates.yaml
kubectl get certificate -n mtls-services
kubectl get certificaterequest -n mtls-services
```

Wait until both Certificate resources show `READY=True`.

## 9. Inspect certificate serial numbers and validity

``` bash
for SECRET in root-ms-tls transaction-ms-tls; do
  echo "========== $SECRET =========="
  kubectl get secret "$SECRET" -n mtls-services \
    -o jsonpath='{.data.tls\.crt}' | base64 -d \
    | openssl x509 -noout -subject -issuer -serial -dates
done
```

Confirm that the certificate issuer/CA matches the CA trusted by both
applications.

## 10. Restart applications and test mTLS

The current POC applications load `/certs/tls.key`, `/certs/tls.crt`,
and `/certs/ca.crt` at startup. If they do not dynamically reload these
files, restart the deployments after initial issuance:

``` bash
kubectl rollout restart deployment/transaction-ms -n mtls-services
kubectl rollout status deployment/transaction-ms -n mtls-services

kubectl rollout restart deployment/root-ms -n mtls-services
kubectl rollout status deployment/root-ms -n mtls-services
```

Test from inside `root-ms` using Kubernetes networking (no host
port-forward):

``` bash
kubectl exec -n mtls-services deployment/root-ms -- node -e '
fetch("http://127.0.0.1:3001/call-transaction")
  .then(async r => {
    console.log("HTTP status:", r.status);
    console.log("Response:", await r.text());
    process.exit(r.ok ? 0 : 1);
  })
  .catch(e => {
    console.error("Request failed:", e.message);
    process.exit(1);
  });
'
```

Expected: HTTP `200`, authenticated client
`root-ms.mtls-services.svc.cluster.local`, and TLS `1.3`.

## 11. Observe automatic renewal --- do not force it

With a one-hour certificate and `renewBefore: 20m`, cert-manager
schedules renewal based on the actual certificate validity timestamps.
Do not manually reissue, clear backoff, or restart cert-manager during
this test.

Open separate terminals.

**Terminal A --- watch Certificate status:**

``` bash
kubectl get certificate -n mtls-services -w
```

**Terminal B --- watch CertificateRequests:**

``` bash
kubectl get certificaterequest -n mtls-services -w
```

**Terminal C --- record the current serial numbers and validity:**

``` bash
date -u
for SECRET in root-ms-tls transaction-ms-tls; do
  echo "========== $SECRET =========="
  kubectl get secret "$SECRET" -n mtls-services \
    -o jsonpath='{.data.tls\.crt}' | base64 -d \
    | openssl x509 -noout -serial -dates
done
```

After the scheduled renewal time, run the same serial/date command
again. Evidence of renewal includes: - a new CertificateRequest/revision
marked `Ready=True`; - new certificate serial numbers; - updated
`notBefore` and `notAfter` timestamps; - events stating that renewal was
scheduled and the certificate was successfully issued.

Check events and logs:

``` bash
kubectl get events -n mtls-services --sort-by='.lastTimestamp' \
  | grep -E 'Renewing|successfully issued|CertificateRequest|Failed'

kubectl logs -n cert-manager deployment/cert-manager --since=30m \
  | grep -E 'root-ms-certificate|transaction-ms-certificate|error|failed|renew'
```

## 12. Backoff troubleshooting

If issuance fails repeatedly, cert-manager applies exponential retry
backoff. Fix the root cause first, then inspect status and events:

``` bash
kubectl describe certificate root-ms-certificate -n mtls-services
kubectl describe certificate transaction-ms-certificate -n mtls-services
kubectl describe issuer vault-issuer -n mtls-services
kubectl get certificaterequest -n mtls-services
kubectl get events -n mtls-services --sort-by='.lastTimestamp'
```

In this POC, Vault had returned `403 permission denied, invalid token`.
We verified the current token, confirmed Vault signing worked, and
corrected the failed-issuance retry state so cert-manager could retry.
The status fields were cleared with the following **recovery-only**
commands:

``` bash
kubectl patch certificate root-ms-certificate -n mtls-services \
  --subresource=status --type=merge \
  -p '{"status":{"failedIssuanceAttempts":null,"lastFailureTime":null}}'

kubectl patch certificate transaction-ms-certificate -n mtls-services \
  --subresource=status --type=merge \
  -p '{"status":{"failedIssuanceAttempts":null,"lastFailureTime":null}}'
```

Do **not** run those commands as part of normal renewal or during the
unattended-renewal test. Use them only as a deliberate recovery step
after investigating the cause.

## 13. Verify application reload after renewal

A renewed Kubernetes Secret does not guarantee an already-running
Node.js process has reloaded its TLS files. After cert-manager renewal,
repeat the mTLS call. If the app has not reloaded the renewed
certificate, perform a controlled rollout restart of `transaction-ms`
and `root-ms`, then test again. Track these separately: 1. cert-manager
renewed the Secret; 2. the application loaded the new certificate; 3.
service-to-service mTLS still succeeds.

## 14. Lessons and recorded result

-   The Vault policy must match `pki/sign/mtls-services`.
-   The cert-manager Secret reference must use Secret
    `vault-issuer-token`, key `token`.
-   Vault dev mode is temporary and loses configuration/tokens on
    restart; use persistent Vault configuration for durable setups.
-   The certificates were successfully issued and both reached
    `Ready=True`.
-   The in-cluster `root-ms` to `transaction-ms` mTLS call returned HTTP
    200, authenticated `root-ms`, and negotiated TLS 1.3.
-   A scheduled renewal succeeded after retry backoff had been cleared.
    To prove fully unattended renewal, observe another scheduled cycle
    without clearing backoff, restarting cert-manager, or forcing
    reissuance.
