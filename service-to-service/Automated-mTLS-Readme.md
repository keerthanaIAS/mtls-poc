# Automated mTLS POC — Setup and Execution README

keerthana@Mac-296 mtls-poc % which openssl
openssl version
/usr/bin/openssl
LibreSSL 3.3.6
keerthana@Mac-296 mtls-poc % 

LibreSSL is a cryptography software library and command-line tool that macOS provides as part of its system tools. It is an alternative to OpenSSL, designed originally as a cleaner, more security-focused fork of OpenSSL.

### LibreSSL vs OpenSSL

| Feature                            | LibreSSL                                                     | OpenSSL                                                                  |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| What it is                         | Cryptography library and tools                               | Cryptography library and tools                                           |
| Available on Mac by default        | Commonly available through `/usr/bin/openssl`                | Usually installed separately if you need the actual OpenSSL distribution |
| Create private keys                | Yes                                                          | Yes                                                                      |
| Create CA and service certificates | Yes                                                          | Yes                                                                      |
| Inspect certificates               | Yes                                                          | Yes                                                                      |
| Command compatibility              | Supports many OpenSSL commands, but not every option/version | Supports its own documented commands and features                        |

### How it worked in our mTLS POC

The flow is:
------------
LibreSSL / OpenSSL commands -> (Generate keys and certificates)
CA + service certificates -> (Root MS and Transaction MS identities)
TLS / mTLS connection -> (Services verify each other's certificates)

## 1. Objective

Implement automated certificate management and mutual TLS (mTLS) communication between two backend services running inside Kubernetes.

- `root-ms`: mTLS client.
- `transaction-ms`: HTTPS server that authenticates the client certificate.
- Vault: Certificate Authority (CA) that signs certificates.
- cert-manager: Requests, manages, and renews service certificates.
- Kubernetes: Runs both services and provides internal service discovery.

**Working flow:**

```text
Vault CA
   |
   v
cert-manager + vault-issuer
   |
   +----> root-ms-certificate --> root-ms-tls
   |
   +----> transaction-ms-certificate --> transaction-ms-tls
                                      |
                                      v
Kubernetes
   |
   v
root-ms
   |
   | HTTPS + client certificate
   | transaction-ms.mtls-services.svc.cluster.local:8443
   v
transaction-ms
   |
   | Validate root-ms certificate
   v
HTTP 200 — Transaction API successful
```

## 2. Environment and project directory

- Host: macOS with Apple Silicon
- Kubernetes: Docker Desktop Kubernetes
- Kubernetes context: `docker-desktop`
- Namespace: `mtls-services`
- Project directory:

```bash
cd /Users/keerthana/Desktop/mtls-poc/service-to-service
```

Project structure:

```text
service-to-service/
├── root-ms/
│   └── server.js
├── transaction-ms/
│   └── server.js
├── k8s/
│   ├── root-ms.yaml
│   └── transaction-ms.yaml
├── root-ms-certificate.yaml
└── transaction-ms-certificate.yaml
```

## 3. Install and verify cert-manager

cert-manager was installed using Helm in the `cert-manager` namespace.

Verify the installation:

```bash
kubectl get pods -n cert-manager
```

The cert-manager controller, cainjector, and webhook were running.

cert-manager automates certificate lifecycle management, including requesting certificates from the configured issuer and renewing them before expiry.

## 4. Install and configure Vault

Vault was installed using Helm in the `vault` namespace and run in development mode for this local POC.

The in-cluster Vault address was:

```text
http://vault.vault.svc.cluster.local:8200
```

The following Vault configuration was completed:

1. Enabled the PKI secrets engine.
2. Created a root CA named `Local MTLS Test CA`.
3. Created the PKI role `mtls-services`.
4. Configured the role to issue service certificates for the `mtls-services.svc.cluster.local` domain.
5. Enabled both server and client certificate usage.
6. Configured ECDSA keys with 256-bit key size.
7. Set certificate TTL to one hour and maximum TTL to 24 hours.
8. Enabled the use of common names and subject alternative names from certificate signing requests.

The signing endpoint used by the issuer was:

```text
pki/sign/mtls-services
```

**Note:** Vault development mode is for testing only; its configuration and data are not suitable for production use.

## 5. Configure the Vault Issuer

Created a cert-manager `Issuer` named `vault-issuer` in the `mtls-services` namespace.

The issuer configuration referenced:

- Vault server: `http://vault.vault.svc.cluster.local:8200`
- PKI signing endpoint: `pki/sign/mtls-services`
- Authentication Secret: `vault-issuer-token`

Verify the issuer:

```bash
kubectl get issuer vault-issuer -n mtls-services
```

Expected result:

```text
NAME           READY
vault-issuer   True
```

This establishes the connection between cert-manager and Vault so cert-manager can request signed service certificates automatically.

## 6. Create the root-ms certificate

Created `root-ms-certificate.yaml` with the following configuration:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: root-ms-certificate
  namespace: mtls-services
spec:
  secretName: root-ms-tls
  duration: 1h
  renewBefore: 20m
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always
  commonName: root-ms.mtls-services.svc.cluster.local
  dnsNames:
    - root-ms.mtls-services.svc.cluster.local
  usages:
    - digital signature
    - server auth
    - client auth
  issuerRef:
    name: vault-issuer
    kind: Issuer
    group: cert-manager.io
```

Apply the certificate resource:

```bash
kubectl apply -f root-ms-certificate.yaml
```

cert-manager requests a certificate from Vault and stores the resulting certificate and private key in the Kubernetes Secret `root-ms-tls`.

## 7. Create the transaction-ms certificate

Created `transaction-ms-certificate.yaml` using the same configuration, with these service-specific values:

```yaml
metadata:
  name: transaction-ms-certificate
spec:
  secretName: transaction-ms-tls
  commonName: transaction-ms.mtls-services.svc.cluster.local
  dnsNames:
    - transaction-ms.mtls-services.svc.cluster.local
```

The remaining configuration matches the root-ms certificate, including the `vault-issuer` reference, ECDSA key settings, duration, renewal window, and key usages.

Apply it:

```bash
kubectl apply -f transaction-ms-certificate.yaml
```

Verify both certificates and their Secrets:

```bash
kubectl get certificates -n mtls-services

kubectl get secrets root-ms-tls transaction-ms-tls \
  -n mtls-services
```

**Verified result:** Both Certificate resources reported `READY=True`. Each TLS Secret contained `tls.crt`, `tls.key`, and `ca.crt`.

This is the automated certificate issuance step: certificates were issued by Vault through cert-manager rather than manually generated and copied into the application.

## 8. Implement the transaction-ms HTTPS server

Created `transaction-ms/server.js`.

The service:

1. Reads its certificate, private key, and trusted CA from `/certs`.
2. Starts an HTTPS server on port `8443`.
3. Sets `requestCert: true` to request a client certificate.
4. Sets `rejectUnauthorized: true` to reject untrusted client certificates.
5. Exposes `/api/transaction` to return a successful response and the authenticated client's certificate common name.

The certificate files are mounted from the `transaction-ms-tls` Secret.

## 9. Implement root-ms as the mTLS client

Created `root-ms/server.js`.

The service:

1. Starts an HTTP server on port `3001`.
2. Exposes `/health` for health checks.
3. Exposes `/call-transaction` to initiate the backend request.
4. Calls `transaction-ms` over HTTPS using the Kubernetes Service DNS name.
5. Presents the root-ms certificate and private key.
6. Uses `ca.crt` to validate the transaction-ms server certificate.
7. Enables certificate verification with `rejectUnauthorized: true`.
8. Uses a five-second request timeout.

The backend URL is:

```text
https://transaction-ms.mtls-services.svc.cluster.local:8443/api/transaction
```

The application uses the `TRANSACTION_HOST` environment variable, with the Kubernetes Service DNS name as its default.

## 10. Configure Kubernetes Deployments and Services

Created the manifests:

- `k8s/root-ms.yaml`
- `k8s/transaction-ms.yaml`

The manifests configure a Deployment and ClusterIP Service for each application.

| Configuration | root-ms | transaction-ms |
|---|---|---|
| Container port | 3001 | 8443 |
| Service type | ClusterIP | ClusterIP |
| TLS Secret | `root-ms-tls` | `transaction-ms-tls` |
| Certificate mount | `/certs` | `/certs` |
| Image | `mtls-root-ms:poc` | `mtls-transaction-ms:poc` |

The Secret volumes are mounted read-only. The root-ms Deployment also sets `TRANSACTION_HOST` to `transaction-ms.mtls-services.svc.cluster.local`.

Apply the manifests:

```bash
kubectl apply -f k8s/transaction-ms.yaml
kubectl apply -f k8s/root-ms.yaml
```

## 11. Resolve the Docker Desktop Kubernetes image issue

The first deployment attempt failed with `ErrImageNeverPull`. The images existed in Docker, but they were not available in the Kubernetes node's containerd image store.

The Docker images were saved on the Mac:

```bash
docker save mtls-root-ms:poc \
  -o /tmp/mtls-root-ms-poc.tar

docker save mtls-transaction-ms:poc \
  -o /tmp/mtls-transaction-ms-poc.tar
```

After enabling **Show system containers (advanced)** in Docker Desktop, the Kubernetes node container became accessible as `desktop-control-plane`.

The images were imported into containerd's Kubernetes namespace:

```bash
NODE=desktop-control-plane

docker exec -i "$NODE" \
  ctr -n k8s.io images import - \
  < /tmp/mtls-root-ms-poc.tar

docker exec -i "$NODE" \
  ctr -n k8s.io images import - \
  < /tmp/mtls-transaction-ms-poc.tar
```

Verify the imported images:

```bash
docker exec "$NODE" \
  ctr -n k8s.io images list |
  grep -E 'mtls-root-ms|mtls-transaction-ms'
```

Both images were successfully imported:

```text
docker.io/library/mtls-root-ms:poc
docker.io/library/mtls-transaction-ms:poc
```

Restart the Deployments and wait for the rollout:

```bash
kubectl rollout restart deployment/root-ms deployment/transaction-ms \
  -n mtls-services

kubectl rollout status deployment/transaction-ms \
  -n mtls-services --timeout=120s

kubectl rollout status deployment/root-ms \
  -n mtls-services --timeout=120s
```

Verify the running workloads:

```bash
kubectl get pods,services -n mtls-services
```

**Verified result:** Both Deployments rolled out successfully, and their new Pods reached `Running` with `1/1 Ready`.

## 12. Test the automated mTLS connection

The final test was executed from the root-ms Pod. It calls the local HTTP endpoint, which then makes the actual HTTPS request to transaction-ms through Kubernetes Service DNS.

```bash
kubectl exec -n mtls-services deployment/root-ms -- \
  node -e "require('http').get('http://127.0.0.1:3001/call-transaction',r=>{console.log('HTTP status:',r.statusCode);r.pipe(process.stdout)}).on('error',e=>{console.error(e.message);process.exit(1)})"
```

### Actual verified output

```text
HTTP status: 200
{"message":"Transaction API called successfully","service":"transaction-ms","authenticatedClient":"root-ms.mtls-services.svc.cluster.local","tlsVersion":"TLSv1.3"}
```

This confirms that:

- Root-ms reached transaction-ms through Kubernetes Service DNS.
- The HTTPS request succeeded with certificate verification enabled.
- Transaction-ms accepted and identified the root-ms client certificate.
- TLS 1.3 was negotiated.
- The transaction endpoint returned HTTP 200.

## 13. Final outcome

The automated mTLS POC successfully established certificate-managed, authenticated communication between two backend services inside Kubernetes.

The implemented automation covers certificate issuance and renewal configuration through cert-manager and Vault. The application uses the issued Kubernetes TLS Secrets without manually generating certificates for each service.

**Completed and verified:** Vault issuer readiness, automatic issuance of both certificates, Kubernetes Secret creation, image import into the Kubernetes node, successful Deployment rollout, and a successful mTLS service-to-service request.

**Important distinction:** The positive mTLS path is verified. Negative tests for missing or untrusted client certificates, server certificate failures, and load testing are separate follow-up tasks. Certificate renewal was configured but has not yet been verified through an actual renewal test.


-----------------------------------------------------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------------------------------------------------------

#### Practical Steps: 

You need a repeatable, practical runbook: if you start from a fresh setup in the future, you should be able to follow the commands in order and reproduce the working automated mTLS POC.

I'll keep the steps in execution order and distinguish what you must create from what you only need to verify. One important detail: the previous setup used Vault in development mode and Docker Desktop's internal Kubernetes containerd image store, so those parts need to be set up again if the environment is reset.

## Step 1 — Start with the correct project directory

For a fresh POC, use:

```
cd /Users/keerthana/Desktop/mtls-poc/service-to-service

kubectl config use-context docker-desktop
kubectl get nodes
docker info
helm version
```

Confirm Docker Desktop Kubernetes is running and the node is `Ready` before continuing.

## Step 2 — Install cert-manager

Run these commands once for a fresh cluster:

```
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set crds.enabled=true

kubectl wait --for=condition=Ready pod \
  -l app.kubernetes.io/instance=cert-manager \
  -n cert-manager --timeout=180s

kubectl get pods -n cert-manager
```

The controller, cainjector, and webhook should be running.

## Step 3 — Install Vault in development mode

```
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update

helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set "server.dev.enabled=true" \
  --set "server.dev.devRootToken=root" \
  --set "injector.enabled=false"

kubectl wait --for=condition=Ready pod/vault-0 \
  -n vault --timeout=180s
```

Create the namespace for the application services:

```
kubectl create namespace mtls-services
```

Important: These are fresh-install commands. Don't run `helm install` or `kubectl create namespace` again if those resources already exist. Vault development mode is for this local POC only; it is not persistent or production-secure.

## Step 4 — Configure Vault's CA and certificate role

Enable Vault's PKI engine and create the root CA:

```
kubectl exec -n vault vault-0 -- sh -c '
  export VAULT_ADDR=http://127.0.0.1:8200
  export VAULT_TOKEN=root

  vault secrets enable -path=pki pki

  vault write pki/config/urls \
    issuing_certificates="http://vault.vault.svc.cluster.local:8200/v1/pki/ca" \
    crl_distribution_points="http://vault.vault.svc.cluster.local:8200/v1/pki/crl"

  vault write pki/root/generate/internal \
    common_name="Local MTLS Test CA" \
    ttl=87600h
'
```

Create the role that permits service certificates:

```
kubectl exec -n vault vault-0 -- sh -c '
  export VAULT_ADDR=http://127.0.0.1:8200
  export VAULT_TOKEN=root

  vault write pki/roles/mtls-services \
    allowed_domains="mtls-services.svc.cluster.local" \
    allow_subdomains=true \
    allow_bare_domains=false \
    require_cn=false \
    server_flag=true \
    client_flag=true \
    key_type=ec \
    key_bits=256 \
    ttl=1h \
    max_ttl=24h \
    use_csr_common_name=true \
    use_csr_sans=true
'
```

These commands are for a fresh Vault PKI engine. If the engine already exists, don't repeat the enable/root-generation commands; verify the existing CA and role instead.

## Step 5 — Create the cert-manager policy and Vault token

Give cert-manager permission to sign certificates through the configured PKI role:

```
kubectl exec -i -n vault vault-0 -- sh -c '
  export VAULT_ADDR=http://127.0.0.1:8200
  export VAULT_TOKEN=root
  vault policy write cert-manager -
' <<'EOF'
path "pki/sign/mtls-services" {
  capabilities = ["create", "update"]
}
EOF
```

Create a limited-lifetime token and store it in Kubernetes:

```
TOKEN=$(kubectl exec -n vault vault-0 -- sh -c '
  export VAULT_ADDR=http://127.0.0.1:8200
  export VAULT_TOKEN=root
  vault token create -policy=cert-manager -ttl=720h -field=token
')

kubectl create secret generic vault-issuer-token \
  -n mtls-services \
  --from-literal=token="$TOKEN"

unset TOKEN
```

Configure the Vault Issuer:

```
cat > vault-issuer.yaml <<'EOF'
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
EOF

kubectl apply -f vault-issuer.yaml
kubectl get issuer vault-issuer -n mtls-services
```

Expected: `READY=True`.

The Vault token is deliberately limited to the signing endpoint rather than using the root token for cert-manager.

## Step 6 — Create the two automatic certificate resources

Create the certificate for `root-ms`:

```
cat > root-ms-certificate.yaml <<'EOF'
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: root-ms-certificate
  namespace: mtls-services
spec:
  secretName: root-ms-tls
  duration: 1h
  renewBefore: 20m
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always
  commonName: root-ms.mtls-services.svc.cluster.local
  dnsNames:
    - root-ms.mtls-services.svc.cluster.local
  usages:
    - digital signature
    - server auth
    - client auth
  issuerRef:
    name: vault-issuer
    kind: Issuer
    group: cert-manager.io
EOF
```

Create the certificate for `transaction-ms`:

```
cat > transaction-ms-certificate.yaml <<'EOF'
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: transaction-ms-certificate
  namespace: mtls-services
spec:
  secretName: transaction-ms-tls
  duration: 1h
  renewBefore: 20m
  privateKey:
    algorithm: ECDSA
    size: 256
    rotationPolicy: Always
  commonName: transaction-ms.mtls-services.svc.cluster.local
  dnsNames:
    - transaction-ms.mtls-services.svc.cluster.local
  usages:
    - digital signature
    - server auth
    - client auth
  issuerRef:
    name: vault-issuer
    kind: Issuer
    group: cert-manager.io
EOF
```

Apply and wait for both certificates:

```
kubectl apply -f root-ms-certificate.yaml
kubectl apply -f transaction-ms-certificate.yaml

kubectl wait --for=condition=Ready certificate/root-ms-certificate \
  -n mtls-services --timeout=120s

kubectl wait --for=condition=Ready certificate/transaction-ms-certificate \
  -n mtls-services --timeout=120s

kubectl get certificates,secrets -n mtls-services
```

Expected: both Certificates show `READY=True`, and the Secrets `root-ms-tls` and `transaction-ms-tls` exist.

The certificates have a one-hour lifetime and are configured for renewal 20 minutes before expiry. The renewal configuration is automatic; an actual renewal still needs to be tested separately.

## Step 7 — Create the application code

### 7.1 Create the transaction-ms HTTPS server

```
mkdir -p root-ms transaction-ms k8s

cat > transaction-ms/server.js <<'EOF'
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  key: fs.readFileSync('/certs/tls.key'),
  cert: fs.readFileSync('/certs/tls.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
}, (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    return res.end('transaction-ms healthy');
  }

  if (req.url === '/api/transaction') {
    const client = req.socket.getPeerCertificate();

    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify({
      message: 'Transaction API called successfully',
      service: 'transaction-ms',
      authenticatedClient: client.subject.CN,
      tlsVersion: req.socket.getProtocol()
    }));
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(8443, '0.0.0.0', () =>
  console.log('transaction-ms listening on 8443 with mTLS')
);
EOF
```

### 7.2 Create the root-ms client

```
cat > root-ms/server.js <<'EOF'
const http = require('http');
const https = require('https');
const fs = require('fs');

const options = {
  hostname: process.env.TRANSACTION_HOST ||
    'transaction-ms.mtls-services.svc.cluster.local',
  port: 8443,
  path: '/api/transaction',
  method: 'GET',
  key: fs.readFileSync('/certs/tls.key'),
  cert: fs.readFileSync('/certs/tls.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
  timeout: 5000
};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    return res.end('root-ms healthy');
  }

  if (req.url !== '/call-transaction') {
    res.writeHead(404);
    return res.end('Not found');
  }

  const outgoing = https.request(options, transactionRes => {
    let body = '';

    transactionRes.on('data', chunk => body += chunk);
    transactionRes.on('end', () => {
      res.writeHead(transactionRes.statusCode || 502, {
        'Content-Type': 'application/json'
      });
      res.end(body);
    });
  });

  outgoing.on('timeout', () =>
    outgoing.destroy(new Error('Request timed out'))
  );

  outgoing.on('error', err => {
    console.error('transaction-ms request failed:', err.message);

    if (!res.headersSent) {
      res.writeHead(502, {'Content-Type': 'application/json'});
    }

    res.end(JSON.stringify({
      error: 'transaction-ms request failed'
    }));
  });

  outgoing.end();
});

server.listen(3001, '0.0.0.0', () =>
  console.log('root-ms listening on 3001')
);
EOF
```

How the mTLS connection works: root-ms presents its certificate to transaction-ms and validates the transaction-ms certificate. Transaction-ms requests and validates the root-ms client certificate. Both services read their certificate files from their own Kubernetes Secret mounts.

## Step 8 — Create Dockerfiles and build the images

Create the root-ms Dockerfile:

```
cat > root-ms/Dockerfile <<'EOF'
FROM node:18-alpine
WORKDIR /app
COPY server.js .
EXPOSE 3001
CMD ["node", "server.js"]
EOF
```

Create the transaction-ms Dockerfile:

```
cat > transaction-ms/Dockerfile <<'EOF'
FROM node:18-alpine
WORKDIR /app
COPY server.js .
EXPOSE 8443
CMD ["node", "server.js"]
EOF
```

Build the two images:

```
docker build -t mtls-root-ms:poc ./root-ms
docker build -t mtls-transaction-ms:poc ./transaction-ms

docker images | grep -E 'mtls-root-ms|mtls-transaction-ms'
```

These are the local images used by the Kubernetes Deployments.

## Step 9 — Create Kubernetes Deployments and Services

Create `k8s/transaction-ms.yaml`:

```
cat > k8s/transaction-ms.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: transaction-ms
  namespace: mtls-services
spec:
  replicas: 1
  selector:
    matchLabels:
      app: transaction-ms
  template:
    metadata:
      labels:
        app: transaction-ms
    spec:
      containers:
        - name: transaction-ms
          image: mtls-transaction-ms:poc
          imagePullPolicy: Never
          ports:
            - containerPort: 8443
          readinessProbe:
            tcpSocket:
              port: 8443
            initialDelaySeconds: 3
            periodSeconds: 5
          volumeMounts:
            - name: tls-certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: tls-certs
          secret:
            secretName: transaction-ms-tls
---
apiVersion: v1
kind: Service
metadata:
  name: transaction-ms
  namespace: mtls-services
spec:
  type: ClusterIP
  selector:
    app: transaction-ms
  ports:
    - port: 8443
      targetPort: 8443
EOF
```

Create `k8s/root-ms.yaml`:

```
cat > k8s/root-ms.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: root-ms
  namespace: mtls-services
spec:
  replicas: 1
  selector:
    matchLabels:
      app: root-ms
  template:
    metadata:
      labels:
        app: root-ms
    spec:
      containers:
        - name: root-ms
          image: mtls-root-ms:poc
          imagePullPolicy: Never
          ports:
            - containerPort: 3001
          env:
            - name: TRANSACTION_HOST
              value: transaction-ms.mtls-services.svc.cluster.local
          volumeMounts:
            - name: tls-certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: tls-certs
          secret:
            secretName: root-ms-tls
---
apiVersion: v1
kind: Service
metadata:
  name: root-ms
  namespace: mtls-services
spec:
  type: ClusterIP
  selector:
    app: root-ms
  ports:
    - port: 3001
      targetPort: 3001
EOF
```

Apply the resources:

```
kubectl apply -f k8s/transaction-ms.yaml
kubectl apply -f k8s/root-ms.yaml
```

## Step 10 — Import images into Docker Desktop Kubernetes

This is the extra step required by your working environment. Docker had the images, but Kubernetes could not find them in its own containerd image store.

Save the images:

```
docker save mtls-root-ms:poc \
  -o /tmp/mtls-root-ms-poc.tar

docker save mtls-transaction-ms:poc \
  -o /tmp/mtls-transaction-ms-poc.tar
```

If the Kubernetes node container isn't visible, open Docker Desktop settings and enable Show system containers (advanced). Then import both images:

```
NODE=desktop-control-plane

docker ps -a --format '{{.Names}} {{.Image}}' |
  grep 'desktop-control-plane'

docker exec -i "$NODE" ctr -n k8s.io images import - \
  < /tmp/mtls-root-ms-poc.tar

docker exec -i "$NODE" ctr -n k8s.io images import - \
  < /tmp/mtls-transaction-ms-poc.tar
```

Verify both images are available:

```
docker exec "$NODE" ctr -n k8s.io images list |
  grep -E 'mtls-root-ms|mtls-transaction-ms'
```

Expected image references:

```
docker.io/library/mtls-root-ms:poc
docker.io/library/mtls-transaction-ms:poc
```

## Step 11 — Start and verify both services

Restart the Deployments so Kubernetes retries using the now-imported images:

```
kubectl rollout restart deployment/root-ms deployment/transaction-ms \
  -n mtls-services

kubectl rollout status deployment/transaction-ms \
  -n mtls-services --timeout=120s

kubectl rollout status deployment/root-ms \
  -n mtls-services --timeout=120s
```

Check the Pods, Services, certificates, and issuer:

```
kubectl get pods,services -n mtls-services
kubectl get certificates -n mtls-services
kubectl get issuer vault-issuer -n mtls-services
```

Proceed when both Pods are `Running` and `1/1 Ready`, both certificates are `READY=True`, and the issuer is ready.

## Step 12 — Run the actual service-to-service mTLS test

Run this from your Mac terminal. It executes the request inside the root-ms Pod, which then calls transaction-ms over Kubernetes Service DNS.

```
kubectl exec -n mtls-services deployment/root-ms -- \
  node -e "require('http').get('http://127.0.0.1:3001/call-transaction',r=>{console.log('HTTP status:',r.statusCode);r.pipe(process.stdout)}).on('error',e=>{console.error(e.message);process.exit(1)})"
```

Expected output, matching your previously successful run:

```
HTTP status: 200
{"message":"Transaction API called successfully","service":"transaction-ms","authenticatedClient":"root-ms.mtls-services.svc.cluster.local","tlsVersion":"TLSv1.3"}
```

This verifies that the transaction service received the request and identified the root-ms client certificate.

## Step 13 — Troubleshooting only if a step fails

| Error                    | What to check                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Issuer is not ready      | Vault Pod, Vault token Secret, Issuer configuration, and PKI signing policy                        |
| Certificate is not ready | `kubectl describe certificate root-ms-certificate -n mtls-services` or the transaction certificate |
| `ErrImageNeverPull`      | Verify image imports and exact image names in the Kubernetes node's containerd store               |
| Pod isn't ready          | `kubectl describe pod -n mtls-services`                                                            |
| HTTP 502 from root-ms    | Check both application logs for TLS verification or connection errors                              |

Useful log commands:

```
kubectl logs deployment/root-ms -n mtls-services
kubectl logs deployment/transaction-ms -n mtls-services
```

Don't recreate certificates or rebuild images unnecessarily; first identify which step failed.

## Final execution checklist

Repeatable POC checklist

0 of 10

Docker Desktop Kubernetes is running

cert-manager is installed and ready

Vault CA and PKI signing role are configured

vault-issuer is READY=True

Both certificates are READY=True

Both TLS Secrets exist

Both application images are imported into containerd

Both Deployments are Running and Ready

Service-to-service test returns HTTP 200

Response identifies root-ms and TLS 1.3

Copy checklist

One final distinction: this runbook reproduces the working positive mTLS path in your local Docker Desktop environment. If you delete the cluster or reset Docker Desktop, you'll need to repeat the infrastructure setup and image import. Because Vault is in development mode, resetting it also loses its CA and PKI configuration.

------------------------------------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------------------------------------

##### Negative Scenarios:

We'll test the negative mTLS cases against your currently working Kubernetes POC in `mtls-services`. We'll keep the existing working certificates and deployments intact, run the tests from inside Kubernetes, and finish with a conclusion of what each test proves.

We'll cover these five cases:

1. Missing client certificate.
2. Client certificate signed by an untrusted CA.
3. Client certificate and private key mismatch.
4. Root-ms does not trust the transaction-ms server CA.
5. Server certificate hostname mismatch.

Important: These tests use temporary test clients or certificates. We won't replace the working `root-ms-tls` or `transaction-ms-tls` Secrets.

## 1. Create temporary negative-test certificates and a test Pod

Run this complete block on your Mac terminal. It does not modify the two working TLS Secrets.

```
cd /Users/keerthana/Desktop/mtls-poc/service-to-service

# Create an untrusted, self-signed client certificate.
openssl ecparam -name prime256v1 -genkey \
  -noout -out /tmp/mtls-untrusted-client.key

openssl req -new -x509 \
  -key /tmp/mtls-untrusted-client.key \
  -out /tmp/mtls-untrusted-client.crt \
  -days 1 \
  -subj "/CN=untrusted-client"

# Keep the temporary Secret reproducible.
kubectl delete secret bad-client-test \
  -n mtls-services --ignore-not-found

kubectl create secret generic bad-client-test \
  -n mtls-services \
  --from-file=untrusted.crt=/tmp/mtls-untrusted-client.crt \
  --from-file=untrusted.key=/tmp/mtls-untrusted-client.key \
  --from-file=mismatch.key=/tmp/mtls-untrusted-client.key

# Create a temporary client Pod using the existing application image.
cat > /tmp/mtls-negative-client.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: mtls-negative-client
  namespace: mtls-services
spec:
  restartPolicy: Never
  containers:
    - name: client
      image: mtls-root-ms:poc
      imagePullPolicy: Never
      command: ["node", "-e", "setInterval(() => {}, 1000000)"]
      volumeMounts:
        - name: trusted
          mountPath: /certs
          readOnly: true
        - name: test-certs
          mountPath: /badcerts
          readOnly: true
  volumes:
    - name: trusted
      secret:
        secretName: root-ms-tls
    - name: test-certs
      secret:
        secretName: bad-client-test
EOF

kubectl apply -f /tmp/mtls-negative-client.yaml

kubectl wait --for=condition=Ready pod/mtls-negative-client \
  -n mtls-services --timeout=120s

echo "Temporary negative-test client is ready."
```

The test Pod uses the trusted CA from `root-ms-tls` to verify the server, while letting us deliberately supply bad client credentials.

## 2. Test 1 — Client without a certificate

```
kubectl exec -i -n mtls-services mtls-negative-client -- node - <<'NODE'
const https = require('https');
const fs = require('fs');

const req = https.get({
  hostname: 'transaction-ms.mtls-services.svc.cluster.local',
  port: 8443,
  path: '/api/transaction',
  ca: fs.readFileSync('/certs/ca.crt'),
  rejectUnauthorized: true
}, res => {
  console.log('UNEXPECTED: HTTP', res.statusCode,
    '- server accepted a client without a certificate');
  res.resume();
  process.exitCode = 1;
});

req.on('error', err => {
  console.log('Connection rejected without client certificate:', err.message);
  console.log('Inspect server logs to confirm the rejection reason.');
});
NODE
```

Expected: The request fails during TLS negotiation, often with a socket reset or TLS alert.

Proves: Whether the server enforces client certificate authentication. A connection error is a promising result, but check the server logs to confirm the missing certificate caused the rejection.

## 3. Test 2 — Client certificate signed by an untrusted CA

```
kubectl exec -i -n mtls-services mtls-negative-client -- node - <<'NODE'
const https = require('https');
const fs = require('fs');

const req = https.get({
  hostname: 'transaction-ms.mtls-services.svc.cluster.local',
  port: 8443,
  path: '/api/transaction',
  key: fs.readFileSync('/badcerts/untrusted.key'),
  cert: fs.readFileSync('/badcerts/untrusted.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),
  rejectUnauthorized: true
}, res => {
  console.log('UNEXPECTED: HTTP', res.statusCode,
    '- server accepted an untrusted client certificate');
  res.resume();
  process.exitCode = 1;
});

req.on('error', err => {
  console.log('Connection rejected with untrusted client certificate:', err.message);
  console.log('Inspect server logs to confirm the rejection reason.');
});
NODE
```

Expected: The server rejects the client certificate because it is self-signed and not trusted by the server's CA configuration.

Proves: The server validates the issuer/trust chain of client certificates rather than accepting any certificate.

## 4. Test 3 — Certificate and private key mismatch

This test deliberately combines the trusted root-ms certificate with a different private key.

```
kubectl exec -i -n mtls-services mtls-negative-client -- node - <<'NODE'
const https = require('https');
const fs = require('fs');

try {
  const req = https.get({
    hostname: 'transaction-ms.mtls-services.svc.cluster.local',
    port: 8443,
    path: '/api/transaction',
    key: fs.readFileSync('/badcerts/mismatch.key'),
    cert: fs.readFileSync('/certs/tls.crt'),
    ca: fs.readFileSync('/certs/ca.crt'),
    rejectUnauthorized: true
  }, res => {
    console.log('UNEXPECTED: HTTP', res.statusCode,
      '- mismatched credentials were accepted');
    res.resume();
    process.exitCode = 1;
  });

  req.on('error', err => {
    console.log('Mismatched credentials rejected:', err.message);
  });
} catch (err) {
  console.log('Mismatched certificate/key rejected locally:', err.message);
}
NODE
```

Expected: Node.js rejects the certificate/key mismatch, either before connecting or during TLS setup.

Proves: A certificate cannot be used with an unrelated private key. Note that rejection by Node.js itself does not prove the server rejected the credentials; it proves the client could not use the mismatched pair.

## 5. Test 4 — Root-ms does not trust the server certificate

Here we keep the real transaction-ms address for DNS resolution but deliberately provide a different trusted CA. The existing server and certificates remain unchanged.

```
kubectl exec -i -n mtls-services mtls-negative-client -- node - <<'NODE'
const https = require('https');
const fs = require('fs');

const req = https.get({
  hostname: 'transaction-ms.mtls-services.svc.cluster.local',
  port: 8443,
  path: '/api/transaction',
  key: fs.readFileSync('/certs/tls.key'),
  cert: fs.readFileSync('/certs/tls.crt'),
  ca: fs.readFileSync('/badcerts/untrusted.crt'),
  rejectUnauthorized: true
}, res => {
  console.log('UNEXPECTED: HTTP', res.statusCode,
    '- client accepted the server certificate');
  res.resume();
  process.exitCode = 1;
});

req.on('error', err => {
  console.log('Server certificate rejected by client:', err.message);
});
NODE
```

Expected: The client rejects the server certificate because it is not signed by the CA it trusts.

Proves: Root-ms validates the server's certificate chain instead of blindly trusting the HTTPS endpoint.

## 6. Test 5 — Server hostname mismatch

The server certificate is valid for `transaction-ms.mtls-services.svc.cluster.local`. Here we deliberately ask Node.js to validate it against a different TLS server name while still connecting to the real Service DNS address.

```
kubectl exec -i -n mtls-services mtls-negative-client -- node - <<'NODE'
const https = require('https');
const fs = require('fs');

const req = https.get({
  hostname: 'transaction-ms.mtls-services.svc.cluster.local',
  servername: 'wrong-server.mtls-services.svc.cluster.local',
  port: 8443,
  path: '/api/transaction',
  key: fs.readFileSync('/certs/tls.key'),
  cert: fs.readFileSync('/certs/tls.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),
  rejectUnauthorized: true
}, res => {
  console.log('UNEXPECTED: HTTP', res.statusCode,
    '- hostname mismatch was accepted');
  res.resume();
  process.exitCode = 1;
});

req.on('error', err => {
  console.log('Hostname validation rejected the server:', err.message);
});
NODE
```

Expected: A hostname/SAN validation error, such as `ERR_TLS_CERT_ALTNAME_INVALID`.

Proves: The client validates not just who signed the certificate, but also whether the certificate identifies the server it intended to contact.

## 7. Verify the results in server logs

After the tests, inspect transaction-ms logs:

```
kubectl logs deployment/transaction-ms -n mtls-services --tail=100
```

A failed client request alone does not always prove which security check failed. Match the client error with the server's TLS error when possible.

Then confirm the working resources are unchanged:

```
kubectl get pods,services,certificates -n mtls-services
kubectl get secrets root-ms-tls transaction-ms-tls -n mtls-services
```

## 8. Clean up the temporary test resources

Once all tests are complete:

```
kubectl delete pod mtls-negative-client \
  -n mtls-services --ignore-not-found

kubectl delete secret bad-client-test \
  -n mtls-services --ignore-not-found

rm -f /tmp/mtls-negative-client.yaml \
  /tmp/mtls-untrusted-client.key \
  /tmp/mtls-untrusted-client.crt
```

This removes only the temporary negative-test resources. It does not delete or replace the working services, certificates, or Vault issuer.

## Conclusion — What we are proving

The positive test already demonstrated that `root-ms` can call `transaction-ms` over Kubernetes Service DNS and receive HTTP 200 using TLS 1.3, with transaction-ms identifying the root-ms certificate.

These negative tests check the other side of that behavior:

| Security check               | What a confirmed rejection demonstrates             |
| ---------------------------- | --------------------------------------------------- |
| No client certificate        | The server requires client authentication           |
| Untrusted client certificate | The server validates client certificate trust       |
| Certificate/key mismatch     | The credential pair is unusable                     |
| Untrusted server CA          | The client validates the server's certificate chain |
| Wrong server hostname        | The client validates the server's identity          |

Overall conclusion: mTLS is not just encryption. It uses certificates to authenticate both sides of a connection. The positive test confirms successful communication; the negative tests help establish that the connection is rejected when required identity or trust checks fail.

