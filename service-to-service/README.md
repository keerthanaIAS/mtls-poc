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

cd /Users/keerthana/Desktop/mtls-poc/service-to-service

echo "========== 1. CREATE ISOLATED PODMAN FILES =========="

mkdir -p podman-runtime/root-ms
mkdir -p podman-runtime/transaction-ms
mkdir -p podman-runtime/certs/root-ms
mkdir -p podman-runtime/certs/transaction-ms

cp root-ms/Dockerfile podman-runtime/root-ms/Dockerfile
cp transaction-ms/Dockerfile podman-runtime/transaction-ms/Dockerfile

# Use Podman network DNS instead of Kubernetes Service DNS.
sed 's/transaction-ms\.mtls-services\.svc\.cluster\.local/transaction-ms/g' \
  root-ms/server.js > podman-runtime/root-ms/server.js

cp transaction-ms/server.js podman-runtime/transaction-ms/server.js

# Copy only the certificates needed by the two services.
cp certs/root-ms/tls.crt podman-runtime/certs/root-ms/
cp certs/root-ms/tls.key podman-runtime/certs/root-ms/
cp certs/ca/ca.crt podman-runtime/certs/root-ms/ca.crt

cp certs/transaction-ms/tls.crt podman-runtime/certs/transaction-ms/
cp certs/transaction-ms/tls.key podman-runtime/certs/transaction-ms/
cp certs/ca/ca.crt podman-runtime/certs/transaction-ms/ca.crt

# Make the isolated certificate copies readable by the container's node user.
chmod 0444 podman-runtime/certs/root-ms/tls.key
chmod 0444 podman-runtime/certs/transaction-ms/tls.key

echo "========== 2. VERIFY PODMAN TARGET =========="
grep -nE 'transaction-ms|https.request|tls.key|tls.crt|ca.crt' \
  podman-runtime/root-ms/server.js

3. Step 3 — Build separate Podman images:

cd /Users/keerthana/Desktop/mtls-poc/service-to-service

echo "========== BUILD ROOT-MS =========="
podman build -t localhost/mtls-root-ms-podman:poc \
  ./podman-runtime/root-ms || exit 1

echo "========== BUILD TRANSACTION-MS =========="
podman build -t localhost/mtls-transaction-ms-podman:poc \
  ./podman-runtime/transaction-ms || exit 1

echo "========== VERIFY IMAGES =========="
podman images | grep -E 'mtls-root-ms-podman|mtls-transaction-ms-podman'

4. Step 4 — Create the isolated network and start containers:

cd /Users/keerthana/Desktop/mtls-poc/service-to-service

echo "========== CREATE PODMAN NETWORK =========="
podman network create mtls-podman-net || exit 1

echo "========== START TRANSACTION-MS =========="
podman run -d \
  --name mtls-transaction-ms-podman \
  --network mtls-podman-net \
  --network-alias transaction-ms \
  -v "$PWD/podman-runtime/certs/transaction-ms:/certs:ro" \
  localhost/mtls-transaction-ms-podman:poc || exit 1

echo "========== START ROOT-MS =========="
podman run -d \
  --name mtls-root-ms-podman \
  --network mtls-podman-net \
  -p 3101:3001 \
  -v "$PWD/podman-runtime/certs/root-ms:/certs:ro" \
  localhost/mtls-root-ms-podman:poc || exit 1

echo "========== CONTAINER STATUS =========="
podman ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "========== TRANSACTION-MS LOGS =========="
podman logs mtls-transaction-ms-podman

echo "========== ROOT-MS LOGS =========="
podman logs mtls-root-ms-podman

5. Step 5 — Verify mTLS communication:

echo "========== ROOT-MS HEALTH =========="
curl -i http://localhost:3101/health

echo "========== ROOT-MS TO TRANSACTION-MS =========="
curl -i http://localhost:3101/call-transaction

6. Run the same load test:

cd /Users/keerthana/Desktop/mtls-poc/service-to-service

podman exec mtls-root-ms-podman node -e '
const http = require("http");
const total = 1000;
const concurrency = 20;
let started = 0, completed = 0, success = 0, failed = 0;
const latencies = [];
const startTime = process.hrtime.bigint();

function request() {
  if (started >= total) return;
  started++;
  const t0 = process.hrtime.bigint();

  const req = http.get("http://127.0.0.1:3001/call-transaction", res => {
    res.resume();
    res.on("end", () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      latencies.push(ms);
      if (res.statusCode === 200) success++;
      else failed++;
      completed++;
      if (completed === total) report();
      else request();
    });
  });

  req.setTimeout(10000, () => req.destroy(new Error("timeout")));
  req.on("error", () => {
    failed++;
    completed++;
    if (completed === total) report();
    else request();
  });
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1] ?? 0;
}

function report() {
  const seconds = Number(process.hrtime.bigint() - startTime) / 1e9;
  console.log("========== PODMAN mTLS LOAD TEST ==========");
  console.log("Total requests:", total);
  console.log("Concurrency:", concurrency);
  console.log("Successful HTTP 200:", success);
  console.log("Failed:", failed);
  console.log("Duration seconds:", seconds.toFixed(2));
  console.log("Requests/sec:", (total / seconds).toFixed(2));
  console.log("Latency average ms:", (latencies.reduce((a,b)=>a+b,0) / (latencies.length || 1)).toFixed(2));
  console.log("Latency p50 ms:", percentile(latencies, 0.50).toFixed(2));
  console.log("Latency p95 ms:", percentile(latencies, 0.95).toFixed(2));
  console.log("Latency p99 ms:", percentile(latencies, 0.99).toFixed(2));
  console.log("Latency max ms:", Math.max(0, ...latencies).toFixed(2));
}

for (let i = 0; i < concurrency; i++) request();
'

**Your Podman mTLS load test completed successfully. All 1,000 requests succeeded, with zero failures**.

## 1. Podman load-test results

Successful requests

# 1,000 / 1,000

Throughput

# 419.16 requests/sec

Average latency

# 47.43 ms

P95 latency

## 60.76 ms

P99 latency

## 79.99 ms

Concurrency: 20 · Duration: 2.39 seconds · Maximum latency: 83.09 ms

## 2. Compare with the earlier Kubernetes test

| Metric              | Kubernetes baseline | Podman   |
| ------------------- | ------------------- | -------- |
| Requests            | 1,000               | 1,000    |
| Concurrency         | 20                  | 20       |
| Successful requests | 1,000               | 1,000    |
| Requests/sec        | 268.96              | 419.16   |
| Average latency     | 73.64 ms            | 47.43 ms |
| P95 latency         | 97 ms               | 60.76 ms |
| P99 latency         | 109 ms              | 79.99 ms |

In this particular run, *Podman achieved about 56% higher throughput* and 36% lower average latency than the earlier Kubernetes baseline.

**Build separate Docker images**:

cd /Users/keerthana/Desktop/mtls-poc/service-to-service

echo "========== BUILD DOCKER ROOT-MS =========="
docker build -t localhost/mtls-root-ms-docker:poc \
  ./podman-runtime/root-ms || exit 1

echo "========== BUILD DOCKER TRANSACTION-MS =========="
docker build -t localhost/mtls-transaction-ms-docker:poc \
  ./podman-runtime/transaction-ms || exit 1

**Start Docker containers**: 

cd /Users/keerthana/Desktop/mtls-poc/service-to-service

echo "========== CREATE DOCKER NETWORK =========="
docker network create mtls-docker-net || exit 1

echo "========== START TRANSACTION-MS =========="
docker run -d \
  --name mtls-transaction-ms-docker \
  --network mtls-docker-net \
  --network-alias transaction-ms \
  -v "$PWD/podman-runtime/certs/transaction-ms:/certs:ro" \
  localhost/mtls-transaction-ms-docker:poc || exit 1

echo "========== START ROOT-MS =========="
docker run -d \
  --name mtls-root-ms-docker \
  --network mtls-docker-net \
  -p 3201:3001 \
  -v "$PWD/podman-runtime/certs/root-ms:/certs:ro" \
  localhost/mtls-root-ms-docker:poc || exit 1

echo "========== DOCKER CONTAINER STATUS =========="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "========== TRANSACTION-MS LOGS =========="
docker logs mtls-transaction-ms-docker

echo "========== ROOT-MS LOGS =========="
docker logs mtls-root-ms-docker

**Step 3 — Verify Docker mTLS before load testing**:

echo "========== DOCKER ROOT-MS HEALTH =========="
curl -i http://localhost:3201/health

echo
echo "========== DOCKER SERVER-TO-SERVER mTLS =========="
curl -i http://localhost:3201/call-transaction

**Step 4 — Run the same load test**:


docker exec mtls-root-ms-docker node -e '
const http = require("http");
const total = 1000;
const concurrency = 20;
let started = 0, completed = 0, success = 0, failed = 0;
const latencies = [];
const startTime = process.hrtime.bigint();

function request() {
  if (started >= total) return;
  started++;
  const t0 = process.hrtime.bigint();

  const req = http.get("http://127.0.0.1:3001/call-transaction", res => {
    res.resume();
    res.on("end", () => {
      latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
      if (res.statusCode === 200) success++;
      else failed++;
      completed++;
      if (completed === total) report();
      else request();
    });
  });

  req.setTimeout(10000, () => req.destroy(new Error("timeout")));
  req.on("error", () => {
    failed++;
    completed++;
    if (completed === total) report();
    else request();
  });
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1] ?? 0;
}

function report() {
  const seconds = Number(process.hrtime.bigint() - startTime) / 1e9;
  console.log("========== DOCKER mTLS LOAD TEST ==========");
  console.log("Total requests:", total);
  console.log("Concurrency:", concurrency);
  console.log("Successful HTTP 200:", success);
  console.log("Failed:", failed);
  console.log("Duration seconds:", seconds.toFixed(2));
  console.log("Requests/sec:", (total / seconds).toFixed(2));
  console.log("Latency average ms:", (latencies.reduce((a,b)=>a+b,0) / (latencies.length || 1)).toFixed(2));
  console.log("Latency p50 ms:", percentile(latencies, 0.50).toFixed(2));
  console.log("Latency p95 ms:", percentile(latencies, 0.95).toFixed(2));
  console.log("Latency p99 ms:", percentile(latencies, 0.99).toFixed(2));
  console.log("Latency max ms:", Math.max(0, ...latencies).toFixed(2));
}

for (let i = 0; i < concurrency; i++) request();
'

*Docker vs. Podman results*:
## Docker vs. Podman results

Both tests used the same mTLS application, 1,000 requests, and concurrency 20.

| Metric              | Docker       | Podman       |
| ------------------- | ------------ | ------------ |
| Successful requests | 1,000        | 1,000        |
| Failed requests     | 0            | 0            |
| Duration            | 2.45 s       | 2.39 s       |
| Throughput          | 408.50 req/s | 419.16 req/s |
| Average latency     | 48.68 ms     | 47.43 ms     |
| P50 latency         | 47.47 ms     | 45.80 ms     |
| P95 latency         | 62.25 ms     | 60.76 ms     |
| P99 latency         | 76.54 ms     | 79.99 ms     |
| Maximum latency     | 78.25 ms     | 83.09 ms     |

Conclusion: Docker and Podman are performing very similarly in this test. Podman has about 2.6% higher throughput, while Docker has slightly better P99 and maximum latency. One run is not enough to establish a consistent performance winner.

#### Increase the load:

Your 5,000-request test completed successfully for both Docker and Podman. All 10,000 requests returned HTTP 200, with zero failures.

## 1. Results comparison

| Metric          | Docker       | Podman       | Better result |
| --------------- | ------------ | ------------ | ------------- |
| Total requests  | 5,000        | 5,000        | Equal         |
| Failed requests | 0            | 0            | Equal         |
| Duration        | 11.20 s      | 10.49 s      | Podman        |
| Throughput      | 446.42 req/s | 476.73 req/s | Podman        |
| Average latency | 111.62 ms    | 104.56 ms    | Podman        |
| P50 latency     | 107.41 ms    | 104.27 ms    | Podman        |
| P95 latency     | 144.45 ms    | 125.12 ms    | Podman        |
| P99 latency     | 196.39 ms    | 151.78 ms    | Podman        |
| Maximum latency | 303.11 ms    | 195.61 ms    | Podman        |

# repeat the same test:

**increase the load to 10,000 requests at concurrency 100**:

## 1. Results at 5,000 requests, concurrency 50

| Metric          | First run: Docker | First run: Podman | Repeat: Docker | Repeat: Podman |
| --------------- | ----------------- | ----------------- | -------------- | -------------- |
| Requests/sec    | 446.42            | 476.73            | 493.63         | 442.93         |
| Average latency | 111.62 ms         | 104.56 ms         | 101.08 ms      | 112.53 ms      |
| P95 latency     | 144.45 ms         | 125.12 ms         | 124.37 ms      | 159.24 ms      |
| P99 latency     | 196.39 ms         | 151.78 ms         | 166.31 ms      | 193.68 ms      |
| Failed          | 0                 | 0                 | 0              | 0              |

The winner changed between runs, which suggests run-to-run variation matters.

## 2. Results at 10,000 requests, concurrency 100

| Metric              | Docker    | Podman    |
| ------------------- | --------- | --------- |
| Successful HTTP 200 | 10,000    | 10,000    |
| Failed              | 0         | 0         |
| Duration            | 19.98 s   | 21.38 s   |
| Requests/sec        | 500.59    | 467.74    |
| Average latency     | 199.43 ms | 213.34 ms |
| P50 latency         | 198.06 ms | 209.69 ms |
| P95 latency         | 249.16 ms | 264.24 ms |
| P99 latency         | 317.75 ms | 352.37 ms |
| Maximum latency     | 347.00 ms | 411.73 ms |

At this load, Docker delivered approximately 7.0% higher throughput and 6.5% lower average latency than Podman. Both still completed all requests successfully.

*Docker performed better in the repeat baseline and at 10,000 requests with concurrency 100. Podman performed better in the first 5,000-request*

**Current conclusion for your POC**:
- Both engines successfully handled 5,000 requests at concurrency 50 and 10,000 requests at concurrency 100.
- Neither test showed request failures.
- Docker was faster in the repeat baseline and the 10,000-request test.
- More repeated runs and resource measurements are needed before making a final performance recommendation.

## 1. Latest test results: 10,000 requests, concurrency 100

| Metric          | Docker — previous run | Docker — latest | Podman — previous run | Podman — latest |
| --------------- | --------------------- | --------------- | --------------------- | --------------- |
| Requests/sec    | 500.59                | 485.89          | 467.74                | 498.44          |
| Average latency | 199.43 ms             | 205.48 ms       | 213.34 ms             | 200.08 ms       |
| P95 latency     | 249.16 ms             | 256.05 ms       | 264.24 ms             | 236.44 ms       |
| P99 latency     | 317.75 ms             | 314.90 ms       | 352.37 ms             | 259.57 ms       |
| Max latency     | 347.00 ms             | 358.07 ms       | 411.73 ms             | 343.83 ms       |
| Failed requests | 0                     | 0               | 0                     | 0               |

In the latest run, Podman achieved about 2.6% higher throughput and 2.6% lower average latency than Docker. Its P95 and P99 latency were also lower.

## 2. What we can conclude so far
* Both engines successfully handled 10,000 requests at concurrency 100.
* Neither engine showed request failures in either run.
* The performance winner changes between runs, so the current results do not establish a consistent advantage for either engine.
* At higher concurrency, average latency increased to around 200 ms for both engines.

## 3. Next: measure CPU and memory

Metric                  Docker          Podman
Total requests          10000           10000
Concurrency             100             100
HTTP 200                10000           10000
Failed                  0               0
Duration                21.08 s         21.73 s
Requests/sec            474.48          460.15
Average latency         210.32 ms       216.75 ms
P50 latency             209.93 ms       214.37 ms
P95 latency             254.17 ms       260.95 ms
P99 latency             286.84 ms       304.76 ms
Maximum latency         334.56 ms       347.96 ms

*Docker was approximately 3.1% faster in throughput and had approximately 3.0% lower average latency in this run. Both engines completed all requests without failures.*

**Current conclusion**: Across the runs, the performance winner has changed, although Docker has performed better in the most recent 10,000-request tests.

#### Observed:

Metric                  Docker          Podman          Difference
Average throughput      505.99 req/s    494.53 req/s    Podman 2.3% lower
Average latency         197.19 ms       201.71 ms       Podman 2.3% higher
Average P95 latency     236.44 ms       232.78 ms       Podman slightly better
Average P99 latency     268.57 ms       285.38 ms       Podman 5.9% higher
Failed requests         0               0               No difference

##### What did your actual results show?

Metric                  Docker       Podman
Throughput              505.99       494.53 req/s
Average latency         197.19 ms    201.71 ms
P95 latency             236.44 ms    232.78 ms
P99 latency             268.57 ms    285.38 ms
Failed requests         0            0

*Docker was about 2.3% faster in average throughput, and its average latency was about 2.2% lower. However, Podman had slightly better average P95 latency.*

**Here is what that means**:
* Throughput: Docker handled about 11 more requests per second.
* Average latency: Docker responded about 4.5 milliseconds faster on average.
* P95 latency: Podman was about 3.7 milliseconds faster for requests at the 95th percentile.
* P99 latency: Docker was about 16.8 milliseconds faster at the 99th percentile.
* Failed requests: Both completed all 10,000 requests successfully.

**So, which is better**?
Docker was slightly faster overall in these tests, but both engines worked successfully.

###### Last Load Test:
In this POC, Docker performed better than Podman in *throughput and average latency*, but the difference was relatively small.

| Metric                        | Docker       | Podman       | Better result |
| ----------------------------- | ------------ | ------------ | ------------- |
| Throughput at concurrency 100 | 527.25 req/s | 500.66 req/s | Docker        |
| Throughput at concurrency 200 | 538.65 req/s | 506.53 req/s | Docker        |
| Throughput at concurrency 500 | 512.82 req/s | 482.04 req/s | Docker        |
| Failed requests               | 0            | 0            | Tie           |
| mTLS verification             | Passed       | Passed       | Tie           |

Final conclusion:

- Performance: Docker was about 5–6% faster in throughput in these tests.
- Security: Both passed the mTLS tests performed, including rejection of connections without a client certificate.
- Reliability: Both completed all load-test requests without failures.
- Overall: Docker wins on measured performance, but this test does not prove Docker is universally better than Podman. Podman remains viable; its suitability depends on your performance requirements and operational needs.

Docker also had *lower average latency* than Podman at all three concurrency levels.

| Concurrency | Docker avg. latency | Podman avg. latency | Lower latency |
| ----------- | ------------------- | ------------------- | ------------- |
| 100         | 189.41 ms           | 199.34 ms           | Docker        |
| 200         | 370.02 ms           | 393.43 ms           | Docker        |
| 500         | 969.07 ms           | 1,030.68 ms         | Docker        |

Averages are calculated from the three trials at each concurrency level.

Latency conclusion: Docker was approximately 5% faster at concurrency 100, 6% at 200, and 6% at 500 based on average latency.

As concurrency increased, latency rose significantly for both engines, while throughput stayed near 500 requests/sec. Docker was faster in this test, but both engines completed all requests without failures.