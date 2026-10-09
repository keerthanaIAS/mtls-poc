1. Create the two correct services:
        mkdir -p root-ms transaction-ms certs/root-ms certs/transaction-ms

2. Create certificates for the actual service names:
# Root-ms client certificate
openssl req -new -newkey rsa:2048 -nodes \
  -keyout certs/root-ms/tls.key \
  -out certs/root-ms/tls.csr \
  -subj "/CN=root-ms"

printf "extendedKeyUsage=clientAuth\n" > certs/root-ms/ext.cnf

openssl x509 -req \
  -in certs/root-ms/tls.csr \
  -CA certs/ca/ca.crt \
  -CAkey certs/ca/ca.key \
  -CAcreateserial \
  -out certs/root-ms/tls.crt \
  -days 365 -sha256 \
  -extfile certs/root-ms/ext.cnf


# Transaction-ms server certificate
openssl req -new -newkey rsa:2048 -nodes \
  -keyout certs/transaction-ms/tls.key \
  -out certs/transaction-ms/tls.csr \
  -subj "/CN=transaction-ms"

cat > certs/transaction-ms/ext.cnf <<'EOF'
subjectAltName=DNS:transaction-ms,DNS:transaction-ms.mtls-services.svc,DNS:transaction-ms.mtls-services.svc.cluster.local
extendedKeyUsage=serverAuth
EOF

openssl x509 -req \
  -in certs/transaction-ms/tls.csr \
  -CA certs/ca/ca.crt \
  -CAkey certs/ca/ca.key \
  -CAcreateserial \
  -out certs/transaction-ms/tls.crt \
  -days 365 -sha256 \
  -extfile certs/transaction-ms/ext.cnf

chmod 600 certs/root-ms/tls.key certs/transaction-ms/tls.key

openssl verify -CAfile certs/ca/ca.crt \
  certs/root-ms/tls.crt certs/transaction-ms/tls.crt

3. Make transaction-ms a continuously running HTTPS server:

* Create transaction-ms/server.js:

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

    res.writeHead(200, { 'Content-Type': 'application/json' });
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

server.listen(8443, '0.0.0.0', () => {
  console.log('transaction-ms listening on 8443 with mTLS');
});

* Create transaction-ms/Dockerfile:

FROM node:18-alpine
WORKDIR /app
COPY server.js .
USER node
EXPOSE 8443
CMD ["node", "server.js"]

4. Make root-ms a continuously running backend that calls transaction-ms:

* Create root-ms/server.js:

const http = require('http');
const https = require('https');
const fs = require('fs');

const options = {
  hostname: process.env.TRANSACTION_HOST || 'transaction-ms.mtls-services.svc.cluster.local',
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

  outgoing.on('timeout', () => outgoing.destroy(new Error('Request timed out')));

  outgoing.on('error', err => {
    console.error('transaction-ms request failed:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'transaction-ms request failed' }));
  });

  outgoing.end();
});

server.listen(3001, '0.0.0.0', () => {
  console.log('root-ms listening on 3001');
});

* Create root-ms/Dockerfile:

FROM node:18-alpine
WORKDIR /app
COPY server.js .
USER node
EXPOSE 3001
CMD ["node", "server.js"]

5. Build the images and load them into Minikube:
docker build -t mtls-root-ms:poc ./root-ms
docker build -t mtls-transaction-ms:poc ./transaction-ms

minikube image load mtls-root-ms:poc
minikube image load mtls-transaction-ms:poc

6. Replace the one-shot Job with two Deployments:

kubectl -n mtls-services delete job service-a --ignore-not-found
kubectl -n mtls-services delete deployment service-b --ignore-not-found
kubectl -n mtls-services delete service service-b --ignore-not-found
kubectl -n mtls-services delete secret service-a-certs --ignore-not-found
kubectl -n mtls-services delete secret service-b-certs --ignore-not-found

* Create the new certificate Secrets:

kubectl -n mtls-services create secret generic root-ms-certs \
  --from-file=tls.crt=certs/root-ms/tls.crt \
  --from-file=tls.key=certs/root-ms/tls.key \
  --from-file=ca.crt=certs/ca/ca.crt

kubectl -n mtls-services create secret generic transaction-ms-certs \
  --from-file=tls.crt=certs/transaction-ms/tls.crt \
  --from-file=tls.key=certs/transaction-ms/tls.key \
  --from-file=ca.crt=certs/ca/ca.crt

* Create k8s/transaction-ms.yaml:

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
            initialDelaySeconds: 2
            periodSeconds: 5
          volumeMounts:
            - name: certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: certs
          secret:
            secretName: transaction-ms-certs
---
apiVersion: v1
kind: Service
metadata:
  name: transaction-ms
  namespace: mtls-services
spec:
  selector:
    app: transaction-ms
  ports:
    - port: 8443
      targetPort: 8443
  type: ClusterIP

* Create k8s/root-ms.yaml:

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
            - name: certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: certs
          secret:
            secretName: root-ms-certs
---
apiVersion: v1
kind: Service
metadata:
  name: root-ms
  namespace: mtls-services
spec:
  selector:
    app: root-ms
  ports:
    - port: 3001
      targetPort: 3001
  type: ClusterIP

* Apply and wait for both services:

kubectl apply -f k8s/transaction-ms.yaml
kubectl -n mtls-services rollout status deployment/transaction-ms --timeout=120s

kubectl apply -f k8s/root-ms.yaml
kubectl -n mtls-services rollout status deployment/root-ms --timeout=120s

kubectl -n mtls-services get deployments,pods,services -o wide

7. Test the actual service-to-service call:
keerthana@Keerthanas-MacBook-Air service-to-service % kubectl -n mtls-services port-forward service/root-ms 3001:3001
Forwarding from 127.0.0.1:3001 -> 3001
Forwarding from [::1]:3001 -> 3001
Handling connection for 3001

keerthana@Keerthanas-MacBook-Air service-to-service % curl -i http://localhost:3001/call-transaction
HTTP/1.1 200 OK
Content-Type: application/json
Date: Fri, 09 Oct 2026 06:10:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"message":"Transaction API called successfully","service":"transaction-ms","authenticatedClient":"root-ms","tlsVersion":"TLSv1.3"}

**What we have now**
* root-ms calls transaction-ms.mtls-services.svc.cluster.local:8443.
* Kubernetes DNS resolves that name to the transaction-ms Service.
* The transaction-ms Service routes the request to its running Pod.
* mTLS authenticates both services.

**Test plan**
1. Security tests - No client certificate → connection rejected. - Untrusted client certificate → connection rejected.
2. Connection failure test - Stop transaction-ms. - Call it from root-ms using Kubernetes DNS. - Verify the error behavior, then restore the service.
3. Load test - Send concurrent requests from inside the cluster. - Measure throughput, latency, success rate, and errors. - Monitor resource usage for both services.

## Terminal Logs:
1. Security test — reject a missing client certificate:
* Commands:
kubectl -n mtls-services exec deployment/root-ms -- node -e '
const https = require("https");
const fs = require("fs");

const req = https.get({
  hostname: "transaction-ms.mtls-services.svc.cluster.local",
  port: 8443,
  path: "/api/transaction",
  ca: fs.readFileSync("/certs/ca.crt"),
  rejectUnauthorized: true,
  timeout: 5000
}, res => {
  console.error("FAIL: Server unexpectedly returned HTTP", res.statusCode);
  res.resume();
  process.exitCode = 1;
});

req.on("error", err => {
  console.log("Expected connection rejection:", err.message);
});

req.on("timeout", () => req.destroy(new Error("Timeout")));
'

* Log:
keerthana@Keerthanas-MacBook-Air service-to-service % kubectl -n mtls-services exec deployment/root-ms -- node -e '
const https = require("https");
const fs = require("fs");

const req = https.get({
  hostname: "transaction-ms.mtls-services.svc.cluster.local",
  port: 8443,
  path: "/api/transaction",
  ca: fs.readFileSync("/certs/ca.crt"),
  rejectUnauthorized: true,
  timeout: 5000
}, res => {
  console.error("FAIL: Server unexpectedly returned HTTP", res.statusCode);
  res.resume();
  process.exitCode = 1;
});

req.on("error", err => {
  console.log("Expected connection rejection:", err.message);
});

req.on("timeout", () => req.destroy(new Error("Timeout")));
'
Expected connection rejection: A0FC8EAFFFFF0000:error:0A00045C:SSL routines:ssl3_read_bytes:tlsv13 alert certificate required:../deps/openssl/openssl/ssl/record/rec_layer_s3.c:1605:SSL alert number 116

keerthana@Keerthanas-MacBook-Air service-to-service % 

2. Security test — reject an untrusted client certificate
* Commands:
mkdir -p certs/untrusted

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/untrusted/bad-ca.key \
  -out certs/untrusted/bad-ca.crt \
  -days 30 -sha256 \
  -subj "/CN=Untrusted-Test-CA"

openssl req -new -newkey rsa:2048 -nodes \
  -keyout certs/untrusted/tls.key \
  -out certs/untrusted/tls.csr \
  -subj "/CN=untrusted-client"

printf 'extendedKeyUsage=clientAuth\n' > certs/untrusted/ext.cnf

openssl x509 -req \
  -in certs/untrusted/tls.csr \
  -CA certs/untrusted/bad-ca.crt \
  -CAkey certs/untrusted/bad-ca.key \
  -CAcreateserial \
  -out certs/untrusted/tls.crt \
  -days 30 -sha256 \
  -extfile certs/untrusted/ext.cnf

chmod 600 certs/untrusted/bad-ca.key certs/untrusted/tls.key

kubectl -n mtls-services delete secret untrusted-client-certs \
  --ignore-not-found

kubectl -n mtls-services create secret generic untrusted-client-certs \
  --from-file=tls.crt=certs/untrusted/tls.crt \
  --from-file=tls.key=certs/untrusted/tls.key \
  --from-file=ca.crt=certs/ca/ca.crt

cat > k8s/untrusted-client-test.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: untrusted-client-test
  namespace: mtls-services
spec:
  restartPolicy: Never
  containers:
    - name: test
      image: mtls-root-ms:poc
      imagePullPolicy: Never
      command: ["node", "-e"]
      args:
        - |
          const https = require("https");
          const fs = require("fs");

          const req = https.get({
            hostname: "transaction-ms.mtls-services.svc.cluster.local",
            port: 8443,
            path: "/api/transaction",
            key: fs.readFileSync("/certs/tls.key"),
            cert: fs.readFileSync("/certs/tls.crt"),
            ca: fs.readFileSync("/certs/ca.crt"),
            rejectUnauthorized: true,
            timeout: 5000
          }, res => {
            console.error("FAIL: Unexpected HTTP response:", res.statusCode);
            res.resume();
            process.exitCode = 1;
          });

          req.on("error", err => {
            console.log("Expected rejection of untrusted client:", err.message);
          });

          req.on("timeout", () => req.destroy(new Error("Timeout")));
      volumeMounts:
        - name: certs
          mountPath: /certs
          readOnly: true
  volumes:
    - name: certs
      secret:
        secretName: untrusted-client-certs
EOF

kubectl -n mtls-services delete pod untrusted-client-test \
  --ignore-not-found --wait=true

kubectl apply -f k8s/untrusted-client-test.yaml

kubectl -n mtls-services wait \
  --for=jsonpath='{.status.phase}'=Succeeded \
  pod/untrusted-client-test --timeout=30s

kubectl -n mtls-services logs untrusted-client-test

* Log:
keerthana@Keerthanas-MacBook-Air service-to-service % >....                                                                             
  -keyout certs/untrusted/bad-ca.key \
  -out certs/untrusted/bad-ca.crt \
  -days 30 -sha256 \
  -subj "/CN=Untrusted-Test-CA"

openssl req -new -newkey rsa:2048 -nodes \
  -keyout certs/untrusted/tls.key \
  -out certs/untrusted/tls.csr \
  -subj "/CN=untrusted-client"

printf 'extendedKeyUsage=clientAuth\n' > certs/untrusted/ext.cnf

openssl x509 -req \
  -in certs/untrusted/tls.csr \
  -CA certs/untrusted/bad-ca.crt \
  -CAkey certs/untrusted/bad-ca.key \
  -CAcreateserial \
  -out certs/untrusted/tls.crt \
  -days 30 -sha256 \
  -extfile certs/untrusted/ext.cnf

chmod 600 certs/untrusted/bad-ca.key certs/untrusted/tls.key
Generating a 2048 bit RSA private key
.....+++++
..+++++
writing new private key to 'certs/untrusted/bad-ca.key'
-----
Generating a 2048 bit RSA private key
............................................................................................................................................................................................................+++++
............+++++
writing new private key to 'certs/untrusted/tls.key'
-----
Signature ok
subject=/CN=untrusted-client
Getting CA Private Key
keerthana@Keerthanas-MacBook-Air service-to-service % kubectl -n mtls-services delete secret untrusted-client-certs \
  --ignore-not-found

kubectl -n mtls-services create secret generic untrusted-client-certs \
  --from-file=tls.crt=certs/untrusted/tls.crt \
  --from-file=tls.key=certs/untrusted/tls.key \
  --from-file=ca.crt=certs/ca/ca.crt
secret/untrusted-client-certs created
keerthana@Keerthanas-MacBook-Air service-to-service % >....                                                                             
            rejectUnauthorized: true,
            timeout: 5000
          }, res => {
            console.error("FAIL: Unexpected HTTP response:", res.statusCode);
            res.resume();
            process.exitCode = 1;
          });

          req.on("error", err => {
            console.log("Expected rejection of untrusted client:", err.message);
          });

          req.on("timeout", () => req.destroy(new Error("Timeout")));
      volumeMounts:
        - name: certs
          mountPath: /certs
          readOnly: true
  volumes:
    - name: certs
      secret:
        secretName: untrusted-client-certs
EOF
keerthana@Keerthanas-MacBook-Air service-to-service % kubectl -n mtls-services delete pod untrusted-client-test \
  --ignore-not-found --wait=true

kubectl apply -f k8s/untrusted-client-test.yaml

kubectl -n mtls-services wait \
  --for=jsonpath='{.status.phase}'=Succeeded \
  pod/untrusted-client-test --timeout=30s

kubectl -n mtls-services logs untrusted-client-test
pod/untrusted-client-test created
pod/untrusted-client-test condition met
Expected rejection of untrusted client: socket hang up
keerthana@Keerthanas-MacBook-Air service-to-service % 

3. Connection failure and recovery test
* Commands:
echo "========== STOP TRANSACTION-MS =========="
kubectl -n mtls-services scale deployment/transaction-ms --replicas=0

kubectl -n mtls-services wait \
  --for=delete pod -l app=transaction-ms --timeout=60s

echo "========== CALL WHILE TRANSACTION-MS IS DOWN =========="
kubectl -n mtls-services exec deployment/root-ms -- node -e '
const http = require("http");

http.get("http://127.0.0.1:3001/call-transaction", res => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    console.log("HTTP status while downstream is down:", res.statusCode);
    console.log("Response:", body);
  });
}).on("error", err => console.error("Request error:", err.message));
'

echo "========== RESTORE TRANSACTION-MS =========="
kubectl -n mtls-services scale deployment/transaction-ms --replicas=1

kubectl -n mtls-services rollout status deployment/transaction-ms \
  --timeout=120s

* Log:
keerthana@Keerthanas-MacBook-Air service-to-service % >....                                                                             
kubectl -n mtls-services wait \
  --for=delete pod -l app=transaction-ms --timeout=60s

echo "========== CALL WHILE TRANSACTION-MS IS DOWN =========="
kubectl -n mtls-services exec deployment/root-ms -- node -e '
const http = require("http");

http.get("http://127.0.0.1:3001/call-transaction", res => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    console.log("HTTP status while downstream is down:", res.statusCode);
    console.log("Response:", body);
  });
}).on("error", err => console.error("Request error:", err.message));
'

echo "========== RESTORE TRANSACTION-MS =========="
kubectl -n mtls-services scale deployment/transaction-ms --replicas=1

kubectl -n mtls-services rollout status deployment/transaction-ms \
  --timeout=120s
========== STOP TRANSACTION-MS ==========
deployment.apps/transaction-ms scaled
pod/transaction-ms-69c6dcc6f5-gqx29 condition met
========== CALL WHILE TRANSACTION-MS IS DOWN ==========
HTTP status while downstream is down: 502
Response: {"error":"transaction-ms request failed"}
========== RESTORE TRANSACTION-MS ==========
deployment.apps/transaction-ms scaled
Waiting for deployment "transaction-ms" rollout to finish: 0 of 1 updated replicas are available...
deployment "transaction-ms" successfully rolled out
keerthana@Keerthanas-MacBook-Air service-to-service % 

4. Load test — 1,000 requests, concurrency 20
* Commands:
kubectl -n mtls-services delete pod mtls-loadgen --ignore-not-found --wait=true

kubectl -n mtls-services run mtls-loadgen \
  --image=mtls-root-ms:poc \
  --image-pull-policy=Never \
  --restart=Never \
  --command -- node -e '
const http = require("http");

const total = 1000;
const concurrency = 20;
const results = new Array(total);
let next = 0;

function requestOnce() {
  return new Promise(resolve => {
    const start = Date.now();

    const req = http.get({
      hostname: "root-ms.mtls-services.svc.cluster.local",
      port: 3001,
      path: "/call-transaction",
      timeout: 15000
    }, res => {
      res.resume();
      res.on("end", () => resolve({
        status: res.statusCode,
        ms: Date.now() - start
      }));
    });

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", err => resolve({
      status: 0,
      ms: Date.now() - start,
      error: err.message
    }));
  });
}

async function worker() {
  while (true) {
    const i = next++;
    if (i >= total) return;
    results[i] = await requestOnce();
  }
}

(async () => {
  const start = Date.now();

  await Promise.all(
    Array.from({length: concurrency}, () => worker())
  );

  const elapsed = (Date.now() - start) / 1000;
  const times = results.map(r => r.ms).sort((a, b) => a - b);
  const successful = results.filter(r => r.status === 200).length;
  const failed = total - successful;

  const percentile = p =>
    times[Math.min(total - 1, Math.ceil(total * p) - 1)];

  console.log("Total requests:", total);
  console.log("Concurrency:", concurrency);
  console.log("Successful HTTP 200:", successful);
  console.log("Failed/non-200:", failed);
  console.log("Duration seconds:", elapsed.toFixed(2));
  console.log("Requests/sec:", (total / elapsed).toFixed(2));
  console.log("Latency average ms:",
    (times.reduce((a, b) => a + b, 0) / total).toFixed(2));
  console.log("Latency p50 ms:", percentile(0.50));
  console.log("Latency p95 ms:", percentile(0.95));
  console.log("Latency p99 ms:", percentile(0.99));
  console.log("Latency max ms:", times[total - 1]);

  if (failed > 0) {
    console.log("Sample failures:",
      JSON.stringify(results.filter(r => r.status !== 200).slice(0, 5)));
    process.exitCode = 1;
  }
})();
'

kubectl -n mtls-services wait \
  --for=jsonpath='{.status.phase}'=Succeeded \
  pod/mtls-loadgen --timeout=180s

kubectl -n mtls-services logs mtls-loadgen

* Log:
keerthana@Keerthanas-MacBook-Air service-to-service % >....                                                                             
  console.log("Duration seconds:", elapsed.toFixed(2));
  console.log("Requests/sec:", (total / elapsed).toFixed(2));
  console.log("Latency average ms:",
    (times.reduce((a, b) => a + b, 0) / total).toFixed(2));
  console.log("Latency p50 ms:", percentile(0.50));
  console.log("Latency p95 ms:", percentile(0.95));
  console.log("Latency p99 ms:", percentile(0.99));
  console.log("Latency max ms:", times[total - 1]);

  if (failed > 0) {
    console.log("Sample failures:",
      JSON.stringify(results.filter(r => r.status !== 200).slice(0, 5)));
    process.exitCode = 1;
  }
})();
'

kubectl -n mtls-services wait \
  --for=jsonpath='{.status.phase}'=Succeeded \
  pod/mtls-loadgen --timeout=180s

kubectl -n mtls-services logs mtls-loadgen
pod/mtls-loadgen created
pod/mtls-loadgen condition met
Total requests: 1000
Concurrency: 20
Successful HTTP 200: 1000
Failed/non-200: 0
Duration seconds: 3.72
Requests/sec: 268.96
Latency average ms: 73.64
Latency p50 ms: 81
Latency p95 ms: 97
Latency p99 ms: 109
Latency max ms: 118
keerthana@Keerthanas-MacBook-Air service-to-service % 

5. Final health and log checks
* Commands:
echo "========== DEPLOYMENTS AND SERVICES =========="
kubectl -n mtls-services get deployments,pods,services -o wide

echo "========== ROOT-MS LOGS =========="
kubectl -n mtls-services logs deployment/root-ms --tail=100

echo "========== TRANSACTION-MS LOGS =========="
kubectl -n mtls-services logs deployment/transaction-ms --tail=100

echo "========== SERVICE DNS =========="
kubectl -n mtls-services exec deployment/root-ms -- node -e '
require("dns").lookup(
  "transaction-ms.mtls-services.svc.cluster.local",
  (err, address) => {
    if (err) {
      console.error(err.message);
      process.exitCode = 1;
    } else {
      console.log("transaction-ms resolved to:", address);
    }
  }
)'

* Log:
keerthana@Keerthanas-MacBook-Air service-to-service % echo "========== DEPLOYMENTS AND SERVICES =========="
kubectl -n mtls-services get deployments,pods,services -o wide

echo "========== ROOT-MS LOGS =========="
kubectl -n mtls-services logs deployment/root-ms --tail=100

echo "========== TRANSACTION-MS LOGS =========="
kubectl -n mtls-services logs deployment/transaction-ms --tail=100

echo "========== SERVICE DNS =========="
kubectl -n mtls-services exec deployment/root-ms -- node -e '
require("dns").lookup(
  "transaction-ms.mtls-services.svc.cluster.local",
  (err, address) => {
    if (err) {
      console.error(err.message);
      process.exitCode = 1;
    } else {
      console.log("transaction-ms resolved to:", address);
    }
  }
)'
========== DEPLOYMENTS AND SERVICES ==========
NAME                             READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS       IMAGES                    SELECTOR
deployment.apps/root-ms          1/1     1            1           44m   root-ms          mtls-root-ms:poc          app=root-ms
deployment.apps/transaction-ms   1/1     1            1           44m   transaction-ms   mtls-transaction-ms:poc   app=transaction-ms

NAME                                  READY   STATUS      RESTARTS   AGE     IP            NODE       NOMINATED NODE   READINESS GATES
pod/mtls-loadgen                      0/1     Completed   0          5m2s    10.244.0.19   minikube   <none>           <none>
pod/no-client-cert                    0/1     Completed   0          19m     10.244.0.16   minikube   <none>           <none>
pod/root-ms-78d57cf6df-k6lf6          1/1     Running     0          44m     10.244.0.15   minikube   <none>           <none>
pod/transaction-ms-69c6dcc6f5-2h9r6   1/1     Running     0          7m1s    10.244.0.18   minikube   <none>           <none>
pod/untrusted-client-test             0/1     Completed   0          8m14s   10.244.0.17   minikube   <none>           <none>

NAME                     TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE   SELECTOR
service/root-ms          ClusterIP   10.99.94.249    <none>        3001/TCP   44m   app=root-ms
service/transaction-ms   ClusterIP   10.98.147.169   <none>        8443/TCP   44m   app=transaction-ms
========== ROOT-MS LOGS ==========
root-ms listening on 3001
transaction-ms request failed: connect ECONNREFUSED 10.98.147.169:8443
========== TRANSACTION-MS LOGS ==========
transaction-ms listening on 8443 with mTLS
========== SERVICE DNS ==========
transaction-ms resolved to: 10.98.147.169
keerthana@Keerthanas-MacBook-Air service-to-service % 

### Test results

1. Missing client certificate - Passed
TLS rejected the connection with `certificate required` (TLS alert 116).

2. Untrusted client certificate - Consistent with rejection
The connection ended with `socket hang up`, consistent with server-side rejection. The client output alone does not prove the precise TLS rejection reason, so treat this as a provisional pass.

3. Downstream unavailable - Passed
With `transaction-ms` scaled to zero, `root-ms` returned HTTP 502. The Deployment was then restored successfully.

4. Load test - Passed
1,000/1,000 requests returned HTTP 200 at concurrency 20.

#### Load-test measurements

1. Throughput

# 268.96 - requests/second

2. Success rate

# 100% - 1,000 of 1,000

3. Average latency

# 73.64 ms

5. P95 latency

# 97 ms

| Additional metric        | Result       |
| ------------------------ | ------------ |
| P50 latency              | 81 ms        |
| P99 latency              | 109 ms       |
| Maximum latency          | 118 ms       |
| Total duration           | 3.72 seconds |                                                                             
| Failed/non-200 responses | 0            |

These are results from your current Minikube POC, not a production capacity benchmark. The reported latency measures the full request through `root-ms` to `transaction-ms`, including the current TLS behavior.

##### Final Kubernetes status

* `root-ms`: 1/1 Running
* `transaction-ms`: 1/1 Running
* Kubernetes DNS: resolved to `10.98.147.169`
* No container restarts reported for either service.
* The application log confirms `ECONNREFUSED` during the intentional downstream outage.



# Podman setup now:

1. Step 1 — Run these commands:

cd /Users/keerthana/Desktop/mtls-poc/service-to-service

echo "========== 1. DIRECTORY STRUCTURE =========="
find . -maxdepth 3 -type f | sort

echo "========== 2. DOCKER CONTAINERS =========="
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'

echo "========== 3. DOCKER IMAGES =========="
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'

echo "========== 4. PODMAN VERSION =========="
podman --version

echo "========== 5. PODMAN MACHINE =========="
podman machine list

echo "========== 6. PODMAN CONTAINERS =========="
podman ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'

echo "========== 7. APPLICATION DOCKERFILES =========="
cat root-ms/Dockerfile
cat transaction-ms/Dockerfile

2. Step 2 — Build and start the Podman services:
