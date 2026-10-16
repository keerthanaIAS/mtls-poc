keerthana@Mac-54 certbot % minikube start
😄  minikube v1.38.1 on Darwin 27.0.1 (arm64)
✨  Using the docker driver based on existing profile

💣  Exiting due to PROVIDER_DOCKER_NOT_RUNNING: "docker version --format <no value>-<no value>:<no value>" exit status 1: Cannot connect to the Docker daemon at unix:///Users/keerthana/.docker/run/docker.sock. Is the docker daemon running?
💡  Suggestion: Start the Docker service
📘  Documentation: https://minikube.sigs.k8s.io/docs/drivers/docker/

keerthana@Mac-54 certbot % minikube start 
😄  minikube v1.38.1 on Darwin 27.0.1 (arm64)
🎉  minikube 1.39.0 is available! Download it: https://github.com/kubernetes/minikube/releases/tag/v1.39.0
💡  To disable this notice, run: 'minikube config set WantUpdateNotification false'

✨  Using the docker driver based on existing profile
👍  Starting "minikube" primary control-plane node in "minikube" cluster
🚜  Pulling base image v0.0.50 ...
🔄  Restarting existing docker container for "minikube" ...
🐳  Preparing Kubernetes v1.35.1 on Docker 29.2.1 ...
🔎  Verifying Kubernetes components...
💡  After the addon is enabled, please run "minikube tunnel" and your ingress resources would be available at "127.0.0.1"
    ▪ Using image gcr.io/k8s-minikube/storage-provisioner:v5
    ▪ Using image registry.k8s.io/ingress-nginx/controller:v1.14.3
    ▪ Using image registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.6.7
    ▪ Using image registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.6.7
🔎  Verifying ingress addon...
🌟  Enabled addons: storage-provisioner, default-storageclass, ingress
🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
keerthana@Mac-54 certbot % cd ~/Desktop/mtls-poc/certbot

pwd
find . -maxdepth 3 -type f \
  ! -path './certbot-config-fresh/*' \
  ! -path './certbot-work-fresh/*' \
  ! -path './certbot-logs-fresh/*' \
  -print

echo "===== COMPOSE ====="
cat compose.yaml

echo "===== AUTH HOOK ====="
cat hooks/auth.sh

echo "===== CLEANUP HOOK ====="
cat hooks/cleanup.sh
/Users/keerthana/Desktop/mtls-poc/certbot
./client.js
./final-security-evidence.txt
./server.js
./Dockerfile
./load-test.js
./certbot-logs/letsencrypt.log.1
./certbot-logs/letsencrypt.log.2
./certbot-logs/letsencrypt.log
./README.md
./certs/client-ca/ca-key.pem
./certs/client-ca/ca.srl
./certs/client-ca/ca.pem
./certs/root-ms-client.csr
./certs/root-ms-client.pem
./certs/client-ext.cnf
./certs/untrusted/ca-key.pem
./certs/untrusted/ca.srl
./certs/untrusted/client.pem
./certs/untrusted/ca.pem
./certs/untrusted/client.csr
./certs/untrusted/client-key.pem
./certs/root-ms-client-key.pem
./certs/pebble-root-ca.pem
./hooks/auth.sh
./hooks/cleanup.sh
./compose.yaml
./server.pid
./server.log
./resource-load-results.txt
===== COMPOSE =====
services:
  pebble:
    image: ghcr.io/letsencrypt/pebble:latest
    command:
      - -config
      - test/config/pebble-config.json
      - -dnsserver
      - 172.28.0.10:8053
    environment:
      PEBBLE_VA_NOSLEEP: "1"
    ports:
      - "14000:14000"
      - "15000:15000"
    networks:
      acme-net:
        ipv4_address: 172.28.0.2
    depends_on:
      - challtestsrv

  challtestsrv:
    image: ghcr.io/letsencrypt/pebble-challtestsrv:latest
    command:
      - -defaultIPv6=
      - -defaultIPv4
      - 172.28.0.10
    ports:
      - "8055:8055"
    networks:
      acme-net:
        ipv4_address: 172.28.0.10

networks:
  acme-net:
    ipam:
      config:
        - subnet: 172.28.0.0/24
===== AUTH HOOK =====
#!/bin/sh
set -eu

curl --fail --silent --show-error \
  -X POST http://127.0.0.1:8055/add-http01 \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${CERTBOT_TOKEN}\",\"content\":\"${CERTBOT_VALIDATION}\"}"

echo "HTTP-01 challenge registered"
===== CLEANUP HOOK =====
#!/bin/sh
set -eu

curl --fail --silent --show-error \
  -X POST http://127.0.0.1:8055/del-http01 \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${CERTBOT_TOKEN}\"}"

echo "HTTP-01 challenge cleaned up"
keerthana@Mac-54 certbot % mkdir -p k8s
kubectl create namespace certbot-poc \
  --dry-run=client -o yaml | kubectl apply -f -
namespace/certbot-poc created
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % cd ~/Desktop/mtls-poc/certbot

echo "===== KUBERNETES ====="
kubectl get nodes
kubectl get pods -A

echo "===== POC README ====="
cat README.md

echo "===== DOCKERFILE ====="
cat Dockerfile

echo "===== CERTBOT COMMANDS ====="
grep -RniE 'certbot certonly|manual-auth-hook|manual-cleanup-hook|renew|transaction-ms.test|acme-directory' \
  README.md compose.yaml Dockerfile hooks client.js server.js
===== KUBERNETES =====
NAME       STATUS   ROLES           AGE     VERSION
minikube   Ready    control-plane   7d21h   v1.35.1
NAMESPACE            NAME                                        READY   STATUS             RESTARTS          AGE
external-https-poc   demo-web-695b49ccb5-hzlnk                   1/1     Running            1 (13m ago)       25h
ingress-nginx        ingress-nginx-admission-create-84kwr        0/1     Completed          0                 25h
ingress-nginx        ingress-nginx-admission-patch-fxj7k         0/1     Completed          0                 25h
ingress-nginx        ingress-nginx-controller-596f8778bc-2hgdj   1/1     Running            1 (13m ago)       25h
kube-system          coredns-7d764666f9-lw24v                    1/1     Running            3 (13m ago)       7d21h
kube-system          etcd-minikube                               1/1     Running            3 (13m ago)       7d21h
kube-system          kube-apiserver-minikube                     1/1     Running            3 (13m ago)       7d21h
kube-system          kube-controller-manager-minikube            1/1     Running            3 (13m ago)       7d21h
kube-system          kube-proxy-sq9fw                            1/1     Running            3 (13m ago)       7d21h
kube-system          kube-scheduler-minikube                     1/1     Running            3 (13m ago)       7d21h
kube-system          storage-provisioner                         1/1     Running            7 (12m ago)       7d21h
mtls-poc             mtls-client-766d66464b-pzhxb                0/1     CrashLoopBackOff   198 (2m23s ago)   7d20h
mtls-poc             mtls-client-test                            0/1     Completed          0                 7d20h
mtls-poc             mtls-negative-bad-client                    0/1     Error              0                 7d19h
mtls-poc             mtls-negative-no-cert                       0/1     Error              0                 7d19h
mtls-poc             mtls-server-6c484ddd67-x2kn7                1/1     Running            3 (13m ago)       7d21h
mtls-services        mtls-loadgen                                0/1     Completed          0                 6d23h
mtls-services        no-client-cert                              0/1     Completed          0                 6d23h
mtls-services        root-ms-78d57cf6df-k6lf6                    1/1     Running            2 (13m ago)       7d
mtls-services        transaction-ms-69c6dcc6f5-2h9r6             1/1     Running            2 (13m ago)       6d23h
mtls-services        untrusted-client-test                       0/1     Completed          0                 6d23h
===== POC README =====
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

===== DOCKERFILE =====
===== CERTBOT COMMANDS =====
README.md:23:2. Pebble tried to resolve transaction-ms.test from inside its container, but that hostname wasn’t resolvable there.
README.md:28:* The failure is now clear: Certbot successfully registered the HTTP-01 challenge, but Pebble tried to validate transaction-ms.test at 127.0.0.1:5002 (::1:5002) and the connection was refused. No certificate has been issued yet.
README.md:33:- Domain: transaction-ms.test
README.md:39:* The -ext error happens because your Mac’s built-in LibreSSL does not support that option. Earlier, your full certificate output already confirmed TLS Web Server Authentication and DNS:transaction-ms.test.
README.md:60:- Not yet tested: production certificate automation, renewal, Kubernetes deployment, and load performance.
README.md:113:- SAN: `DNS:transaction-ms.test` — correct.
client.js:7:  hostname: 'transaction-ms.test',
keerthana@Mac-54 certbot % >....                                                                                                                                                                               
kind: Service
metadata:
  name: pebble
  namespace: certbot-poc
spec:
  type: ClusterIP
  selector:
    app: pebble
  ports:
    - name: acme
      port: 14000
      targetPort: 14000
    - name: management
      port: 15000
      targetPort: 15000
YAML

# Create Pebble Deployment
cat > k8s/pebble-deployment.yaml <<YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pebble
  namespace: certbot-poc
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pebble
  template:
    metadata:
      labels:
        app: pebble
    spec:
      containers:
        - name: pebble
          image: ghcr.io/letsencrypt/pebble:latest
          args:
            - "-config"
            - "test/config/pebble-config.json"
            - "-dnsserver"
            - "$CHALLENGE_IP:8053"
          env:
            - name: PEBBLE_VA_NOSLEEP
              value: "1"
          ports:
            - name: acme
              containerPort: 14000
            - name: management
              containerPort: 15000
YAML

kubectl apply -f k8s/pebble-deployment.yaml

# Wait and inspect
kubectl rollout status deployment/challtestsrv -n certbot-poc --timeout=120s
kubectl rollout status deployment/pebble -n certbot-poc --timeout=120s

kubectl get pods,svc -n certbot-poc
kubectl logs deployment/challtestsrv -n certbot-poc --tail=30
kubectl logs deployment/pebble -n certbot-poc --tail=50
zsh: command not found: #
service/challtestsrv created
Challenge Service IP: 10.110.221.133
zsh: command not found: #
deployment.apps/challtestsrv created
zsh: command not found: #
service/pebble created
zsh: command not found: #
deployment.apps/pebble created
zsh: command not found: #
Waiting for deployment "challtestsrv" rollout to finish: 0 of 1 updated replicas are available...
deployment "challtestsrv" successfully rolled out
Waiting for deployment "pebble" rollout to finish: 0 of 1 updated replicas are available...
deployment "pebble" successfully rolled out
NAME                                READY   STATUS    RESTARTS   AGE
pod/challtestsrv-765dc95d8b-bhk74   1/1     Running   0          10s
pod/pebble-6bbb64fb9c-k4scm         1/1     Running   0          10s

NAME                   TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                      AGE
service/challtestsrv   ClusterIP   10.110.221.133   <none>        8053/UDP,8055/TCP,5002/TCP   10s
service/pebble         ClusterIP   10.106.134.146   <none>        14000/TCP,15000/TCP          10s
pebble-challtestsrv - 2026/10/16 06:11:19 Creating HTTP-01 challenge server on :5002
pebble-challtestsrv - 2026/10/16 06:11:19 Creating HTTPS HTTP-01 challenge server on :5003
pebble-challtestsrv - 2026/10/16 06:11:19 Creating TCP and UDP DNS server on :8053
pebble-challtestsrv - 2026/10/16 06:11:19 Creating DoH server on :8443
pebble-challtestsrv - 2026/10/16 06:11:19 Creating TLS-ALPN-01 challenge server on :5001
pebble-challtestsrv - 2026/10/16 06:11:19 Answering A queries with 10.110.221.133 by default
pebble-challtestsrv - 2026/10/16 06:11:19 Starting challenge servers
pebble-challtestsrv - 2026/10/16 06:11:19 Starting management server on :8055
pebble-challtestsrv - 2026/10/16 06:11:19 open : no such file or directory
Pebble 2026/10/16 06:11:24 Starting Pebble ACME server
Pebble 2026/10/16 06:11:24 Generated new root issuer CN=Pebble Root CA 57637d with serial 7f62b05ce3e4d493 and SKI 8e30d10a53fc07f2aefb9af853c98f1404dc6323
Pebble 2026/10/16 06:11:24 Generated new intermediate issuer CN=Pebble Intermediate CA 738232 with serial 7be1a779ff6682e6 and SKI 788135167a28f87a6c77b068dcb2ab69ccce604a
Pebble 2026/10/16 06:11:24 Generated issuance chain: Pebble Root CA 57637d -> Pebble Intermediate CA 738232
Pebble 2026/10/16 06:11:24 Loaded profile "default" with certificate validity period of 7776000 seconds (promote CN=false)
Pebble 2026/10/16 06:11:24 Loaded profile "shortlived" with certificate validity period of 518400 seconds (promote CN=false)
Pebble 2026/10/16 06:11:24 Using custom DNS resolver for ACME challenges: 10.110.221.133:8053
Pebble 2026/10/16 06:11:24 Disabling random VA sleeps
Pebble 2026/10/16 06:11:24 No CAA identities configured, using default [pebble.letsencrypt.org]
Pebble 2026/10/16 06:11:24 Configured to reject 5% of good nonces
Pebble 2026/10/16 06:11:24 Configured to attempt authz reuse for each identifier 50% of the time
Pebble 2026/10/16 06:11:24 Configured to show 3 orders per page
Pebble 2026/10/16 06:11:24 Management interface listening on: 0.0.0.0:15000
Pebble 2026/10/16 06:11:24 Root CA certificate available at: https://0.0.0.0:15000/roots/0
Pebble 2026/10/16 06:11:24 Listening on: 0.0.0.0:14000
Pebble 2026/10/16 06:11:24 ACME directory available at: https://0.0.0.0:14000/dir
keerthana@Mac-54 certbot % kubectl get pods,svc -n certbot-poc
kubectl describe deployment pebble -n certbot-poc
kubectl logs deployment/pebble -n certbot-poc --tail=80
NAME                                READY   STATUS    RESTARTS   AGE
pod/challtestsrv-765dc95d8b-bhk74   1/1     Running   0          25s
pod/pebble-6bbb64fb9c-k4scm         1/1     Running   0          25s

NAME                   TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                      AGE
service/challtestsrv   ClusterIP   10.110.221.133   <none>        8053/UDP,8055/TCP,5002/TCP   25s
service/pebble         ClusterIP   10.106.134.146   <none>        14000/TCP,15000/TCP          25s
Name:                   pebble
Namespace:              certbot-poc
CreationTimestamp:      Fri, 16 Oct 2026 11:41:15 +0530
Labels:                 <none>
Annotations:            deployment.kubernetes.io/revision: 1
Selector:               app=pebble
Replicas:               1 desired | 1 updated | 1 total | 1 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=pebble
  Containers:
   pebble:
    Image:       ghcr.io/letsencrypt/pebble:latest
    Ports:       14000/TCP (acme), 15000/TCP (management)
    Host Ports:  0/TCP (acme), 0/TCP (management)
    Args:
      -config
      test/config/pebble-config.json
      -dnsserver
      10.110.221.133:8053
    Environment:
      PEBBLE_VA_NOSLEEP:  1
    Mounts:               <none>
  Volumes:                <none>
  Node-Selectors:         <none>
  Tolerations:            <none>
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  <none>
NewReplicaSet:   pebble-6bbb64fb9c (1/1 replicas created)
Events:
  Type    Reason             Age   From                   Message
  ----    ------             ----  ----                   -------
  Normal  ScalingReplicaSet  25s   deployment-controller  Scaled up replica set pebble-6bbb64fb9c from 0 to 1
Pebble 2026/10/16 06:11:24 Starting Pebble ACME server
Pebble 2026/10/16 06:11:24 Generated new root issuer CN=Pebble Root CA 57637d with serial 7f62b05ce3e4d493 and SKI 8e30d10a53fc07f2aefb9af853c98f1404dc6323
Pebble 2026/10/16 06:11:24 Generated new intermediate issuer CN=Pebble Intermediate CA 738232 with serial 7be1a779ff6682e6 and SKI 788135167a28f87a6c77b068dcb2ab69ccce604a
Pebble 2026/10/16 06:11:24 Generated issuance chain: Pebble Root CA 57637d -> Pebble Intermediate CA 738232
Pebble 2026/10/16 06:11:24 Loaded profile "default" with certificate validity period of 7776000 seconds (promote CN=false)
Pebble 2026/10/16 06:11:24 Loaded profile "shortlived" with certificate validity period of 518400 seconds (promote CN=false)
Pebble 2026/10/16 06:11:24 Using custom DNS resolver for ACME challenges: 10.110.221.133:8053
Pebble 2026/10/16 06:11:24 Disabling random VA sleeps
Pebble 2026/10/16 06:11:24 No CAA identities configured, using default [pebble.letsencrypt.org]
Pebble 2026/10/16 06:11:24 Configured to reject 5% of good nonces
Pebble 2026/10/16 06:11:24 Configured to attempt authz reuse for each identifier 50% of the time
Pebble 2026/10/16 06:11:24 Configured to show 3 orders per page
Pebble 2026/10/16 06:11:24 Management interface listening on: 0.0.0.0:15000
Pebble 2026/10/16 06:11:24 Root CA certificate available at: https://0.0.0.0:15000/roots/0
Pebble 2026/10/16 06:11:24 Listening on: 0.0.0.0:14000
Pebble 2026/10/16 06:11:24 ACME directory available at: https://0.0.0.0:14000/dir
keerthana@Mac-54 certbot % kubectl get pods -n certbot-poc -o wide
kubectl get events -n certbot-poc --sort-by=.lastTimestamp
NAME                            READY   STATUS    RESTARTS   AGE   IP            NODE       NOMINATED NODE   READINESS GATES
challtestsrv-765dc95d8b-bhk74   1/1     Running   0          30s   10.244.0.36   minikube   <none>           <none>
pebble-6bbb64fb9c-k4scm         1/1     Running   0          30s   10.244.0.37   minikube   <none>           <none>
LAST SEEN   TYPE     REASON              OBJECT                               MESSAGE
30s         Normal   Scheduled           pod/challtestsrv-765dc95d8b-bhk74    Successfully assigned certbot-poc/challtestsrv-765dc95d8b-bhk74 to minikube
30s         Normal   Scheduled           pod/pebble-6bbb64fb9c-k4scm          Successfully assigned certbot-poc/pebble-6bbb64fb9c-k4scm to minikube
30s         Normal   Pulling             pod/pebble-6bbb64fb9c-k4scm          Pulling image "ghcr.io/letsencrypt/pebble:latest"
30s         Normal   Pulling             pod/challtestsrv-765dc95d8b-bhk74    Pulling image "ghcr.io/letsencrypt/pebble-challtestsrv:latest"
30s         Normal   ScalingReplicaSet   deployment/pebble                    Scaled up replica set pebble-6bbb64fb9c from 0 to 1
30s         Normal   SuccessfulCreate    replicaset/pebble-6bbb64fb9c         Created pod: pebble-6bbb64fb9c-k4scm
30s         Normal   SuccessfulCreate    replicaset/challtestsrv-765dc95d8b   Created pod: challtestsrv-765dc95d8b-bhk74
30s         Normal   ScalingReplicaSet   deployment/challtestsrv              Scaled up replica set challtestsrv-765dc95d8b from 0 to 1
26s         Normal   Created             pod/challtestsrv-765dc95d8b-bhk74    Container created
26s         Normal   Started             pod/challtestsrv-765dc95d8b-bhk74    Container started
26s         Normal   Pulled              pod/challtestsrv-765dc95d8b-bhk74    Successfully pulled image "ghcr.io/letsencrypt/pebble-challtestsrv:latest" in 4.186s (4.186s including waiting). Image size: 6700999 bytes.
22s         Normal   Pulled              pod/pebble-6bbb64fb9c-k4scm          Successfully pulled image "ghcr.io/letsencrypt/pebble:latest" in 4.074s (8.019s including waiting). Image size: 7487431 bytes.
22s         Normal   Created             pod/pebble-6bbb64fb9c-k4scm          Container created
21s         Normal   Started             pod/pebble-6bbb64fb9c-k4scm          Container started
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % cd ~/Desktop/mtls-poc/certbot
mkdir -p k8s

cat > k8s/Dockerfile.certbot <<'EOF'
FROM certbot/certbot:latest
RUN apk add --no-cache curl
EOF

minikube image build -t certbot-poc:local -f k8s/Dockerfile.certbot .
#0 building with "default" instance using docker driver

#1 [internal] load build definition from Dockerfile.certbot
#1 transferring dockerfile: 101B done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/certbot/certbot:latest
#2 DONE 4.3s

#3 [internal] load .dockerignore
#3 transferring context: 2B done
#3 DONE 0.0s

#4 [1/2] FROM docker.io/certbot/certbot:latest@sha256:f70ad0adbb7e117f0fe42a63c553f28ea451edabc0148757b6efcd9735acaa20
#4 resolve docker.io/certbot/certbot:latest@sha256:f70ad0adbb7e117f0fe42a63c553f28ea451edabc0148757b6efcd9735acaa20 done
#4 sha256:778be53ef0aaea7ab52e14d251c17847dd212e70221e99dc88d8ce6c84716cca 2.62kB / 2.62kB done
#4 sha256:fe24f3a57c90655af3adcd254ea9bba353114c2be6d3afbaf12d7f90eacde0de 0B / 16.47MB 0.1s
#4 sha256:f70ad0adbb7e117f0fe42a63c553f28ea451edabc0148757b6efcd9735acaa20 990B / 990B done
#4 sha256:ee901aeb343b763b55793f2f6503b4be78ca970adcfdc333c2936a15c7489ebb 7.43kB / 7.43kB done
#4 sha256:14a4754c352fba4c6c0da8e4f01bb990463c19f7ff63e090073c385bd2bc5046 0B / 4.18MB 0.1s
#4 sha256:eafc87f422bd6ab1b6e7ed254105e570b00133cb586e3f1a976c9e293ab827c1 0B / 411.75kB 0.1s
#4 sha256:14a4754c352fba4c6c0da8e4f01bb990463c19f7ff63e090073c385bd2bc5046 1.05MB / 4.18MB 0.4s
#4 extracting sha256:14a4754c352fba4c6c0da8e4f01bb990463c19f7ff63e090073c385bd2bc5046
#4 sha256:14a4754c352fba4c6c0da8e4f01bb990463c19f7ff63e090073c385bd2bc5046 4.18MB / 4.18MB 0.5s done
#4 extracting sha256:14a4754c352fba4c6c0da8e4f01bb990463c19f7ff63e090073c385bd2bc5046 0.1s done
#4 sha256:f80f4eae4153d67998d2890f877bcc628c40c8dc350d02cd3432966592f18924 0B / 249B 0.5s
#4 extracting sha256:eafc87f422bd6ab1b6e7ed254105e570b00133cb586e3f1a976c9e293ab827c1
#4 sha256:eafc87f422bd6ab1b6e7ed254105e570b00133cb586e3f1a976c9e293ab827c1 411.75kB / 411.75kB 0.6s done
#4 extracting sha256:eafc87f422bd6ab1b6e7ed254105e570b00133cb586e3f1a976c9e293ab827c1 0.1s done
#4 sha256:8a8f87f0b2196aab07d2644f5cce1bc36a2b748000006ce27913c1d25575966e 0B / 113B 0.7s
#4 sha256:fe24f3a57c90655af3adcd254ea9bba353114c2be6d3afbaf12d7f90eacde0de 7.34MB / 16.47MB 1.0s
#4 sha256:f80f4eae4153d67998d2890f877bcc628c40c8dc350d02cd3432966592f18924 249B / 249B 0.8s done
#4 sha256:8a8f87f0b2196aab07d2644f5cce1bc36a2b748000006ce27913c1d25575966e 113B / 113B 0.9s done
#4 sha256:b1eefa540e8d3a8bc74e8ce7d386af7192e983e6f4bb3d7260294d9ea456b8f7 0B / 41.32kB 1.0s
#4 sha256:7d7da32b50f81523b23fa58db5e4dd393fa84976ac4a53b635d5a051b72f0914 0B / 34.59kB 1.0s
#4 sha256:fe24f3a57c90655af3adcd254ea9bba353114c2be6d3afbaf12d7f90eacde0de 16.47MB / 16.47MB 1.2s
#4 sha256:b1eefa540e8d3a8bc74e8ce7d386af7192e983e6f4bb3d7260294d9ea456b8f7 41.32kB / 41.32kB 1.1s done
#4 sha256:7d7da32b50f81523b23fa58db5e4dd393fa84976ac4a53b635d5a051b72f0914 34.59kB / 34.59kB 1.2s done
#4 sha256:6230b113444b1cfa05c38f07f1baf7584e2c14b67814fdae0375fb1836c8763a 0B / 87.53kB 1.2s
#4 sha256:fbd6dd195d62f6d8b14eab7197b5284b28f9d246ecb3524769cffceebac3e483 0B / 705.32kB 1.2s
#4 sha256:fe24f3a57c90655af3adcd254ea9bba353114c2be6d3afbaf12d7f90eacde0de 16.47MB / 16.47MB 1.2s done
#4 extracting sha256:fe24f3a57c90655af3adcd254ea9bba353114c2be6d3afbaf12d7f90eacde0de 0.1s
#4 sha256:a37facd7648c1d0570fa17181f9332f914c29f0d15eb3bdd834fdf563a71ec58 0B / 4.89MB 1.3s
#4 sha256:6230b113444b1cfa05c38f07f1baf7584e2c14b67814fdae0375fb1836c8763a 87.53kB / 87.53kB 1.4s done
#4 sha256:fbd6dd195d62f6d8b14eab7197b5284b28f9d246ecb3524769cffceebac3e483 705.32kB / 705.32kB 1.5s done
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 0B / 57.23MB 1.5s
#4 extracting sha256:fe24f3a57c90655af3adcd254ea9bba353114c2be6d3afbaf12d7f90eacde0de 0.6s done
#4 sha256:a37facd7648c1d0570fa17181f9332f914c29f0d15eb3bdd834fdf563a71ec58 2.10MB / 4.89MB 1.8s
#4 extracting sha256:f80f4eae4153d67998d2890f877bcc628c40c8dc350d02cd3432966592f18924 done
#4 extracting sha256:8a8f87f0b2196aab07d2644f5cce1bc36a2b748000006ce27913c1d25575966e done
#4 extracting sha256:b1eefa540e8d3a8bc74e8ce7d386af7192e983e6f4bb3d7260294d9ea456b8f7
#4 sha256:a37facd7648c1d0570fa17181f9332f914c29f0d15eb3bdd834fdf563a71ec58 4.89MB / 4.89MB 1.9s done
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 7.34MB / 57.23MB 1.9s
#4 extracting sha256:b1eefa540e8d3a8bc74e8ce7d386af7192e983e6f4bb3d7260294d9ea456b8f7 done
#4 extracting sha256:7d7da32b50f81523b23fa58db5e4dd393fa84976ac4a53b635d5a051b72f0914 done
#4 extracting sha256:6230b113444b1cfa05c38f07f1baf7584e2c14b67814fdae0375fb1836c8763a done
#4 extracting sha256:fbd6dd195d62f6d8b14eab7197b5284b28f9d246ecb3524769cffceebac3e483
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 10.49MB / 57.23MB 2.0s
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 15.73MB / 57.23MB 2.1s
#4 extracting sha256:fbd6dd195d62f6d8b14eab7197b5284b28f9d246ecb3524769cffceebac3e483 0.2s done
#4 extracting sha256:a37facd7648c1d0570fa17181f9332f914c29f0d15eb3bdd834fdf563a71ec58
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 24.12MB / 57.23MB 2.2s
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 27.26MB / 57.23MB 2.3s
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 34.60MB / 57.23MB 2.5s
#4 extracting sha256:a37facd7648c1d0570fa17181f9332f914c29f0d15eb3bdd834fdf563a71ec58 0.2s done
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 42.99MB / 57.23MB 2.7s
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 46.14MB / 57.23MB 2.8s
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 49.28MB / 57.23MB 2.9s
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 53.48MB / 57.23MB 3.0s
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 56.62MB / 57.23MB 3.1s
#4 extracting sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41
#4 sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 57.23MB / 57.23MB 3.1s done
#4 extracting sha256:712b8c3e59484cd5d6db3d3daef6fed5e4d0efd409185a4e243ff8a17acb3b41 1.0s done
#4 DONE 4.2s

#5 [2/2] RUN apk add --no-cache curl
#5 1.517 (1/8) Installing brotli-libs (1.2.0-r0)
#5 1.576 (2/8) Installing c-ares (1.34.8-r0)
#5 1.622 (3/8) Installing libunistring (1.4.1-r0)
#5 1.713 (4/8) Installing libidn2 (2.3.8-r0)
#5 1.761 (5/8) Installing nghttp2-libs (1.69.0-r0)
#5 1.807 (6/8) Installing libpsl (0.21.5-r3)
#5 1.860 (7/8) Installing libcurl (8.22.0-r0)
#5 1.924 (8/8) Installing curl (8.22.0-r0)
#5 1.977 Executing busybox-1.37.0-r30.trigger
#5 1.982 OK: 35.2 MiB in 44 packages
#5 DONE 2.1s

#6 exporting to image
#6 exporting layers 0.0s done
#6 writing image sha256:c6ab26084f9cbd3f749730eb00a5dcd2bac3169abd7824e2ec312fa34c71164a done
#6 naming to docker.io/library/certbot-poc:local done
#6 DONE 0.0s
keerthana@Mac-54 certbot % cat > k8s/auth.sh <<'EOF'
#!/bin/sh
set -eu

curl --fail --silent --show-error \
  -X POST http://challtestsrv.certbot-poc.svc.cluster.local:8055/add-http01 \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${CERTBOT_TOKEN}\",\"content\":\"${CERTBOT_VALIDATION}\"}"

echo "HTTP-01 challenge registered"
EOF

cat > k8s/cleanup.sh <<'EOF'
#!/bin/sh
set -eu

curl --fail --silent --show-error \
  -X POST http://challtestsrv.certbot-poc.svc.cluster.local:8055/del-http01 \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${CERTBOT_TOKEN}\"}"

echo "HTTP-01 challenge cleaned up"
EOF

kubectl create configmap certbot-hooks \
  -n certbot-poc \
  --from-file=auth.sh=k8s/auth.sh \
  --from-file=cleanup.sh=k8s/cleanup.sh \
  --dry-run=client -o yaml | kubectl apply -f -
configmap/certbot-hooks created
keerthana@Mac-54 certbot % kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: certbot-data
  namespace: certbot-poc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
EOF

kubectl get pvc -n certbot-poc
persistentvolumeclaim/certbot-data created
NAME           STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
certbot-data   Bound    pvc-163cfd0f-0b18-46f4-aca7-2504e5c6b6ea   1Gi        RWO            standard       <unset>                 0s
keerthana@Mac-54 certbot % kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: certbot-client
  namespace: certbot-poc
spec:
  containers:
    - name: certbot
      image: certbot-poc:local
      imagePullPolicy: Never
      command: ["sh", "-c", "sleep 36000"]
      volumeMounts:
        - name: data
          mountPath: /var/lib/letsencrypt
        - name: hooks
          mountPath: /hooks
          readOnly: true
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: certbot-data
    - name: hooks
      configMap:
        name: certbot-hooks
        defaultMode: 0555
EOF

kubectl wait -n certbot-poc \
  --for=condition=Ready pod/certbot-client --timeout=120s

kubectl exec -n certbot-poc certbot-client -- certbot --version
kubectl exec -n certbot-poc certbot-client -- certbot --help all | grep -E 'preferred-profile|no-verify-ssl'
pod/certbot-client created
pod/certbot-client condition met
certbot 5.8.0
  --preferred-profile PREFERRED_PROFILE
  --no-verify-ssl       Disable verification of the ACME server's certificate.
keerthana@Mac-54 certbot % kubectl get pods,svc,pvc -n certbot-poc
kubectl exec -n certbot-poc certbot-client -- \
  curl -k -sS https://pebble.certbot-poc.svc.cluster.local:14000/dir
NAME                                READY   STATUS    RESTARTS   AGE
pod/certbot-client                  1/1     Running   0          8s
pod/challtestsrv-765dc95d8b-bhk74   1/1     Running   0          3m13s
pod/pebble-6bbb64fb9c-k4scm         1/1     Running   0          3m13s

NAME                   TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                      AGE
service/challtestsrv   ClusterIP   10.110.221.133   <none>        8053/UDP,8055/TCP,5002/TCP   3m13s
service/pebble         ClusterIP   10.106.134.146   <none>        14000/TCP,15000/TCP          3m13s

NAME                                 STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/certbot-data   Bound    pvc-163cfd0f-0b18-46f4-aca7-2504e5c6b6ea   1Gi        RWO            standard       <unset>                 15s
{
   "keyChange": "https://pebble.certbot-poc.svc.cluster.local:14000/rollover-account-key",
   "meta": {
      "caaIdentities": [
         "pebble.letsencrypt.org"
      ],
      "externalAccountRequired": false,
      "profiles": {
         "default": "The profile you know and love",
         "shortlived": "A short-lived cert profile, without actual enforcement"
      },
      "termsOfService": "data:text/plain,Do%20what%20thou%20wilt"
   },
   "newAccount": "https://pebble.certbot-poc.svc.cluster.local:14000/sign-me-up",
   "newNonce": "https://pebble.certbot-poc.svc.cluster.local:14000/nonce-plz",
   "newOrder": "https://pebble.certbot-poc.svc.cluster.local:14000/order-plz",
   "renewalInfo": "https://pebble.certbot-poc.svc.cluster.local:14000/draft-ietf-acme-ari-03/renewalInfo",
   "revokeCert": "https://pebble.certbot-poc.svc.cluster.local:14000/revoke-cert"
}%                                                                                                                                                                                                             keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % kubectl exec -n certbot-poc certbot-client -- certbot certonly \
  --server https://pebble.certbot-poc.svc.cluster.local:14000/dir \
  --manual \
  --preferred-challenges http \
  --manual-auth-hook /hooks/auth.sh \
  --manual-cleanup-hook /hooks/cleanup.sh \
  --preferred-profile shortlived \
  --agree-tos \
  --register-unsafely-without-email \
  --manual-public-ip-logging-ok \
  --non-interactive \
  --no-verify-ssl \
  --config-dir /var/lib/letsencrypt/config \
  --work-dir /var/lib/letsencrypt/work \
  --logs-dir /var/lib/letsencrypt/logs \
  -d transaction-ms.test
usage: 
  certbot [SUBCOMMAND] [options] [-d DOMAIN] [-d DOMAIN] ...

Certbot can obtain and install HTTPS/TLS/SSL certificates.  By default,
it will attempt to use a webserver both for obtaining and installing the
certificate. 
certbot: error: unrecognized arguments: --manual-public-ip-logging-ok
command terminated with exit code 2
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % kubectl exec -n certbot-poc certbot-client -- certbot certonly \
  --server https://pebble.certbot-poc.svc.cluster.local:14000/dir \
  --manual \
  --preferred-challenges http \
  --manual-auth-hook /hooks/auth.sh \
  --manual-cleanup-hook /hooks/cleanup.sh \
  --preferred-profile shortlived \
  --agree-tos \
  --register-unsafely-without-email \
  --non-interactive \
  --no-verify-ssl \
  --config-dir /var/lib/letsencrypt/config \
  --work-dir /var/lib/letsencrypt/work \
  --logs-dir /var/lib/letsencrypt/logs \
  -d transaction-ms.test
Saving debug log to /var/lib/letsencrypt/logs/letsencrypt.log
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
Account registered.
Requesting a certificate for transaction-ms.test
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
Hook '--manual-auth-hook' for transaction-ms.test ran with output:
 HTTP-01 challenge registered
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(

Certbot failed to authenticate some domains (authenticator: manual). The Certificate Authority reported these problems:
  Identifier: transaction-ms.test
  Type:   connection
  Detail: Get "http://transaction-ms.test:5002/.well-known/acme-challenge/uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk": error occurred while resolving URL "http://transaction-ms.test:5002/.well-known/acme-challenge/uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk": dial tcp 10.110.221.133:8053: i/o timeout

Hint: The Certificate Authority failed to verify the challenge files created by the --manual-auth-hook. Ensure that this hook is functioning correctly. Refer to "certbot --help manual" and the Certbot User Guide.

Hook '--manual-cleanup-hook' for transaction-ms.test ran with output:
 HTTP-01 challenge cleaned up
Some challenges have failed.
Ask for help or search for solutions at https://community.letsencrypt.org. See the logfile /var/lib/letsencrypt/logs/letsencrypt.log or re-run Certbot with -v for more details.
command terminated with exit code 1
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % kubectl get svc challtestsrv -n certbot-poc -o yaml
kubectl get endpoints challtestsrv -n certbot-poc
kubectl get pods -n certbot-poc -o wide
kubectl logs deployment/challtestsrv -n certbot-poc
kubectl logs deployment/pebble -n certbot-poc --tail=40
apiVersion: v1
kind: Service
metadata:
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"v1","kind":"Service","metadata":{"annotations":{},"name":"challtestsrv","namespace":"certbot-poc"},"spec":{"ports":[{"name":"dns","port":8053,"protocol":"UDP","targetPort":8053},{"name":"api","port":8055,"targetPort":8055},{"name":"challenge","port":5002,"targetPort":5002}],"selector":{"app":"challtestsrv"},"type":"ClusterIP"}}
  creationTimestamp: "2026-10-16T06:11:15Z"
  name: challtestsrv
  namespace: certbot-poc
  resourceVersion: "49497"
  uid: 89890680-8242-406d-99a3-4958fe596c68
spec:
  clusterIP: 10.110.221.133
  clusterIPs:
  - 10.110.221.133
  internalTrafficPolicy: Cluster
  ipFamilies:
  - IPv4
  ipFamilyPolicy: SingleStack
  ports:
  - name: dns
    port: 8053
    protocol: UDP
    targetPort: 8053
  - name: api
    port: 8055
    protocol: TCP
    targetPort: 8055
  - name: challenge
    port: 5002
    protocol: TCP
    targetPort: 5002
  selector:
    app: challtestsrv
  sessionAffinity: None
  type: ClusterIP
status:
  loadBalancer: {}
Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice
NAME           ENDPOINTS                                            AGE
challtestsrv   10.244.0.36:8053,10.244.0.36:8055,10.244.0.36:5002   7m32s
NAME                            READY   STATUS    RESTARTS   AGE     IP            NODE       NOMINATED NODE   READINESS GATES
certbot-client                  1/1     Running   0          4m27s   10.244.0.38   minikube   <none>           <none>
challtestsrv-765dc95d8b-bhk74   1/1     Running   0          7m32s   10.244.0.36   minikube   <none>           <none>
pebble-6bbb64fb9c-k4scm         1/1     Running   0          7m32s   10.244.0.37   minikube   <none>           <none>
pebble-challtestsrv - 2026/10/16 06:11:19 Creating HTTP-01 challenge server on :5002
pebble-challtestsrv - 2026/10/16 06:11:19 Creating HTTPS HTTP-01 challenge server on :5003
pebble-challtestsrv - 2026/10/16 06:11:19 Creating TCP and UDP DNS server on :8053
pebble-challtestsrv - 2026/10/16 06:11:19 Creating DoH server on :8443
pebble-challtestsrv - 2026/10/16 06:11:19 Creating TLS-ALPN-01 challenge server on :5001
pebble-challtestsrv - 2026/10/16 06:11:19 Answering A queries with 10.110.221.133 by default
pebble-challtestsrv - 2026/10/16 06:11:19 Starting challenge servers
pebble-challtestsrv - 2026/10/16 06:11:19 Starting management server on :8055
pebble-challtestsrv - 2026/10/16 06:11:19 open : no such file or directory
pebble-challtestsrv - 2026/10/16 06:18:18 Added HTTP-01 challenge for token "uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk" - key auth "uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk.IrZmgemFoZ4JxdWviY4zARBpfVwtUuaoB_JKVVpuH0E"
pebble-challtestsrv - 2026/10/16 06:18:22 Removed HTTP-01 challenge for token "uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk"
Pebble 2026/10/16 06:11:24 Starting Pebble ACME server
Pebble 2026/10/16 06:11:24 Generated new root issuer CN=Pebble Root CA 57637d with serial 7f62b05ce3e4d493 and SKI 8e30d10a53fc07f2aefb9af853c98f1404dc6323
Pebble 2026/10/16 06:11:24 Generated new intermediate issuer CN=Pebble Intermediate CA 738232 with serial 7be1a779ff6682e6 and SKI 788135167a28f87a6c77b068dcb2ab69ccce604a
Pebble 2026/10/16 06:11:24 Generated issuance chain: Pebble Root CA 57637d -> Pebble Intermediate CA 738232
Pebble 2026/10/16 06:11:24 Loaded profile "default" with certificate validity period of 7776000 seconds (promote CN=false)
Pebble 2026/10/16 06:11:24 Loaded profile "shortlived" with certificate validity period of 518400 seconds (promote CN=false)
Pebble 2026/10/16 06:11:24 Using custom DNS resolver for ACME challenges: 10.110.221.133:8053
Pebble 2026/10/16 06:11:24 Disabling random VA sleeps
Pebble 2026/10/16 06:11:24 No CAA identities configured, using default [pebble.letsencrypt.org]
Pebble 2026/10/16 06:11:24 Configured to reject 5% of good nonces
Pebble 2026/10/16 06:11:24 Configured to attempt authz reuse for each identifier 50% of the time
Pebble 2026/10/16 06:11:24 Configured to show 3 orders per page
Pebble 2026/10/16 06:11:24 Management interface listening on: 0.0.0.0:15000
Pebble 2026/10/16 06:11:24 Root CA certificate available at: https://0.0.0.0:15000/roots/0
Pebble 2026/10/16 06:11:24 Listening on: 0.0.0.0:14000
Pebble 2026/10/16 06:11:24 ACME directory available at: https://0.0.0.0:14000/dir
Pebble 2026/10/16 06:14:28 GET /dir -> calling handler()
Pebble 2026/10/16 06:18:18 GET /dir -> calling handler()
Pebble 2026/10/16 06:18:18 HEAD /nonce-plz -> calling handler()
Pebble 2026/10/16 06:18:18 POST /sign-me-up -> calling handler()
Pebble 2026/10/16 06:18:18 HEAD /nonce-plz -> calling handler()
Pebble 2026/10/16 06:18:18 POST /sign-me-up -> calling handler()
Pebble 2026/10/16 06:18:18 There are now 1 accounts in memory
Pebble 2026/10/16 06:18:18 POST /order-plz -> calling handler()
Pebble 2026/10/16 06:18:18 There are now 1 authorizations in the db
Pebble 2026/10/16 06:18:18 Added order "3CNcJ0OKAzVrfckn3aV9RTUTYhvogNKBrIMP1QQHnFA" to the db
Pebble 2026/10/16 06:18:18 There are now 1 orders in the db
Pebble 2026/10/16 06:18:18 POST /authZ/ -> calling handler()
Pebble 2026/10/16 06:18:18 POST /chalZ/ -> calling handler()
Pebble 2026/10/16 06:18:18 Pulled a task from the Tasks queue: &va.vaTask{Identifier:acme.Identifier{Type:"dns", Value:"transaction-ms.test"}, Challenge:(*core.Challenge)(0x4000171520), Account:(*core.Account)(0x400009f8c0), AccountURL:"https://pebble.certbot-poc.svc.cluster.local:14000/my-account/408002d1203015df", Wildcard:false}
Pebble 2026/10/16 06:18:18 Starting 3 validations.
Pebble 2026/10/16 06:18:18 Attempting to validate w/ HTTP: http://transaction-ms.test:5002/.well-known/acme-challenge/uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk
Pebble 2026/10/16 06:18:18 Attempting to validate w/ HTTP: http://transaction-ms.test:5002/.well-known/acme-challenge/uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk
Pebble 2026/10/16 06:18:18 Attempting to validate w/ HTTP: http://transaction-ms.test:5002/.well-known/acme-challenge/uay_Z94_iIEAnzRwrcjGobrFPlfqX-O70AQ6hWWBHvk
Pebble 2026/10/16 06:18:19 POST /authZ/ -> calling handler()
Pebble 2026/10/16 06:18:20 authz J74XH_ihXSKJI6cTVQ0uxRB9CQu3n7HnY1LgsDpT6Zs set INVALID by completed challenge 4ABca8Pc87t1YlCzOGgvuTwc-fRPBuHhTIEYkt2BqQI
Pebble 2026/10/16 06:18:20 order 3CNcJ0OKAzVrfckn3aV9RTUTYhvogNKBrIMP1QQHnFA set INVALID by invalid authz J74XH_ihXSKJI6cTVQ0uxRB9CQu3n7HnY1LgsDpT6Zs
Pebble 2026/10/16 06:18:22 POST /authZ/ -> calling handler()
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % kubectl patch svc challtestsrv -n certbot-poc --type=json \
  -p='[{"op":"add","path":"/spec/ports/-","value":{"name":"dns-tcp","port":8053,"protocol":"TCP","targetPort":8053}}]'
service/challtestsrv patched
keerthana@Mac-54 certbot % kubectl get svc challtestsrv -n certbot-poc
NAME           TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                               AGE
challtestsrv   ClusterIP   10.110.221.133   <none>        8053/UDP,8055/TCP,5002/TCP,8053/TCP   8m12s
keerthana@Mac-54 certbot % kubectl exec -n certbot-poc certbot-client -- certbot certonly \
  --server https://pebble.certbot-poc.svc.cluster.local:14000/dir \
  --manual \
  --preferred-challenges http \
  --manual-auth-hook /hooks/auth.sh \
  --manual-cleanup-hook /hooks/cleanup.sh \
  --preferred-profile shortlived \
  --agree-tos \
  --register-unsafely-without-email \
  --non-interactive \
  --no-verify-ssl \
  --config-dir /var/lib/letsencrypt/config \
  --work-dir /var/lib/letsencrypt/work \
  --logs-dir /var/lib/letsencrypt/logs \
  -d transaction-ms.test
Saving debug log to /var/lib/letsencrypt/logs/letsencrypt.log
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
Requesting a certificate for transaction-ms.test
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
Hook '--manual-auth-hook' for transaction-ms.test ran with output:
 HTTP-01 challenge registered
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
Hook '--manual-cleanup-hook' for transaction-ms.test ran with output:
 HTTP-01 challenge cleaned up
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(

Successfully received certificate.
Certificate is saved at: /var/lib/letsencrypt/config/live/transaction-ms.test/fullchain.pem
Key is saved at:         /var/lib/letsencrypt/config/live/transaction-ms.test/privkey.pem
This certificate expires on 2026-10-22.
These files will be updated when the certificate renews.
NEXT STEPS:
- The certificate will need to be renewed before it expires. Certbot can automatically renew the certificate in the background, but you may need to take steps to enable that functionality. See https://certbot.org/renewal-setup for instructions.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
If you like Certbot, please consider supporting our work by:
 * Donating to ISRG / Let's Encrypt:   https://letsencrypt.org/donate
 * Donating to EFF:                    https://eff.org/donate-le
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
keerthana@Mac-54 certbot % kubectl exec -n certbot-poc certbot-client -- openssl x509 \
  -in /var/lib/letsencrypt/config/live/transaction-ms.test/cert.pem \
  -noout -subject -issuer -serial -dates \
  -ext subjectAltName -ext extendedKeyUsage
subject=
issuer=CN=Pebble Intermediate CA 738232
serial=32A7FD41E815523D
notBefore=Oct 16 06:19:34 2026 GMT
notAfter=Oct 22 06:19:33 2026 GMT
X509v3 Extended Key Usage: 
    TLS Web Server Authentication
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % kubectl exec -n certbot-poc certbot-client -- certbot renew \
  --force-renewal \
  --no-verify-ssl \
  --config-dir /var/lib/letsencrypt/config \
  --work-dir /var/lib/letsencrypt/work \
  --logs-dir /var/lib/letsencrypt/logs
Saving debug log to /var/lib/letsencrypt/logs/letsencrypt.log

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Processing /var/lib/letsencrypt/config/renewal/transaction-ms.test.conf
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
Renewing an existing certificate for transaction-ms.test
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Congratulations, all renewals succeeded: 
  /var/lib/letsencrypt/config/live/transaction-ms.test/fullchain.pem (success)
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
keerthana@Mac-54 certbot % kubectl exec -n certbot-poc certbot-client -- openssl x509 \
  -in /var/lib/letsencrypt/config/live/transaction-ms.test/cert.pem \
  -noout -issuer -serial -dates
issuer=CN=Pebble Intermediate CA 738232
serial=131D574F4533BA28
notBefore=Oct 16 06:29:30 2026 GMT
notAfter=Oct 22 06:29:29 2026 GMT
keerthana@Mac-54 certbot % cat > /tmp/certbot-renew-cronjob.yaml <<'EOF'
apiVersion: batch/v1
kind: CronJob
metadata:
  name: certbot-renew
  namespace: certbot-poc
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 2
  failedJobsHistoryLimit: 2
  jobTemplate:
    spec:
      backoffLimit: 1
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: certbot
              image: certbot-poc:local
              imagePullPolicy: Never
              command:
                - certbot
                - renew
                - --no-verify-ssl
                - --config-dir
                - /var/lib/letsencrypt/config
                - --work-dir
                - /var/lib/letsencrypt/work
                - --logs-dir
                - /var/lib/letsencrypt/logs
              volumeMounts:
                - name: certbot-data
                  mountPath: /var/lib/letsencrypt
                - name: certbot-hooks
                  mountPath: /hooks
                  readOnly: true
          volumes:
            - name: certbot-data
              persistentVolumeClaim:
                claimName: certbot-data
            - name: certbot-hooks
              configMap:
                name: certbot-hooks
                defaultMode: 0555
EOF

kubectl apply -f /tmp/certbot-renew-cronjob.yaml
kubectl get cronjob -n certbot-poc
cronjob.batch/certbot-renew created
NAME            SCHEDULE      TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
certbot-renew   */5 * * * *   <none>     False     0        <none>          0s
keerthana@Mac-54 certbot % kubectl get jobs -n certbot-poc
kubectl get pods -n certbot-poc
No resources found in certbot-poc namespace.
NAME                            READY   STATUS    RESTARTS   AGE
certbot-client                  1/1     Running   0          25m
challtestsrv-765dc95d8b-bhk74   1/1     Running   0          29m
pebble-6bbb64fb9c-k4scm         1/1     Running   0          29m
keerthana@Mac-54 certbot % kubectl get jobs -n certbot-poc
kubectl logs -n certbot-poc job/REPLACE_WITH_JOB_NAME
No resources found in certbot-poc namespace.
error: error from server (NotFound): jobs.batch "REPLACE_WITH_JOB_NAME" not found in namespace "certbot-poc"
keerthana@Mac-54 certbot % kubectl get jobs -n certbot-poc
kubectl logs -n certbot-poc job/certbot-renew         
No resources found in certbot-poc namespace.
error: error from server (NotFound): jobs.batch "certbot-renew" not found in namespace "certbot-poc"
keerthana@Mac-54 certbot % kubectl create job certbot-renew-manual-test \
  --from=cronjob/certbot-renew \
  -n certbot-poc
job.batch/certbot-renew-manual-test created
keerthana@Mac-54 certbot % kubectl get jobs -n certbot-poc
kubectl get pods -n certbot-poc
NAME                        STATUS     COMPLETIONS   DURATION   AGE
certbot-renew-manual-test   Complete   1/1           4s         4s
NAME                              READY   STATUS      RESTARTS   AGE
certbot-client                    1/1     Running     0          27m
certbot-renew-manual-test-w7zlw   0/1     Completed   0          4s
challtestsrv-765dc95d8b-bhk74     1/1     Running     0          30m
pebble-6bbb64fb9c-k4scm           1/1     Running     0          30m
keerthana@Mac-54 certbot % kubectl logs -n certbot-poc job/certbot-renew-manual-test
Saving debug log to /var/lib/letsencrypt/logs/letsencrypt.log

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Processing /var/lib/letsencrypt/config/renewal/transaction-ms.test.conf
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
/usr/local/lib/python3.14/site-packages/urllib3/connectionpool.py:1110: InsecureRequestWarning: Unverified HTTPS request is being made to host 'pebble.certbot-poc.svc.cluster.local'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings
  warnings.warn(
Certificate not yet due for renewal

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
The following certificates are not due for renewal yet:
  /var/lib/letsencrypt/config/live/transaction-ms.test/fullchain.pem expires on 2026-10-22 (skipped)
No renewals were attempted.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
keerthana@Mac-54 certbot % 
keerthana@Mac-54 certbot % kubectl get cronjob certbot-renew -n certbot-poc
kubectl get jobs -n certbot-poc
NAME            SCHEDULE      TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
certbot-renew   */5 * * * *   <none>     False     0        69s             15m
NAME                     STATUS     COMPLETIONS   DURATION   AGE
certbot-renew-29868890   Complete   1/1           4s         6m9s
certbot-renew-29868895   Complete   1/1           3s         69s
keerthana@Mac-54 certbot % 

* The key distinction:
- CronJob = the schedule that triggers renewal checks.
- Job = one execution of the renewal command.
- Certbot = decides whether the certificate actually needs renewal.
- Pebble = the test certificate authority that issues certificates.