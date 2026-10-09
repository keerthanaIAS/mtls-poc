# Minikube and Kubernetes:
keerthana@Mac-1107 mtls-poc % minikube status

kubectl get nodes -o wide

kubectl get pods -A
minikube
type: Control Plane
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured

NAME       STATUS   ROLES           AGE     VERSION   INTERNAL-IP    EXTERNAL-IP   OS-IMAGE                         KERNEL-VERSION    CONTAINER-RUNTIME
minikube   Ready    control-plane   2m17s   v1.35.1   192.168.49.2   <none>        Debian GNU/Linux 12 (bookworm)   7.0.12-linuxkit   docker://29.2.1
NAMESPACE     NAME                               READY   STATUS    RESTARTS      AGE
kube-system   coredns-7d764666f9-lw24v           1/1     Running   0             2m8s
kube-system   etcd-minikube                      1/1     Running   0             2m15s
kube-system   kube-apiserver-minikube            1/1     Running   0             2m15s
kube-system   kube-controller-manager-minikube   1/1     Running   0             2m15s
kube-system   kube-proxy-sq9fw                   1/1     Running   0             2m9s
kube-system   kube-scheduler-minikube            1/1     Running   0             2m15s
kube-system   storage-provisioner                1/1     Running   1 (99s ago)   2m13s
keerthana@Mac-1107 mtls-poc % docker build -t mtls-server:latest ./server

docker build -t mtls-client:latest ./client
[+] Building 0.4s (8/8) FINISHED                                                                                   docker:desktop-linux
 => [internal] load build definition from Dockerfile                                                                               0.0s
 => => transferring dockerfile: 116B                                                                                               0.0s
 => [internal] load metadata for docker.io/library/node:18-alpine                                                                  0.2s
 => [internal] load .dockerignore                                                                                                  0.0s
 => => transferring context: 2B                                                                                                    0.0s
 => [1/3] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e            0.0s
 => => resolve docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e            0.0s
 => [internal] load build context                                                                                                  0.0s
 => => transferring context: 765B                                                                                                  0.0s
 => CACHED [2/3] WORKDIR /app                                                                                                      0.0s
 => [3/3] COPY server.js .                                                                                                         0.0s
 => exporting to image                                                                                                             0.1s
 => => exporting layers                                                                                                            0.0s
 => => exporting manifest sha256:b96fda609d22c4521fe1c391516a2c5844e68582dd70be727c8b6d7f40894bf5                                  0.0s
 => => exporting config sha256:cc23ac06e6d929e975c45bee93cf0102e84e6302288d3a254056db6254e22bcb                                    0.0s
 => => exporting attestation manifest sha256:ba10f700c20294a2b27547afd0ac623d32597fb2eff7ba702c2f8e45402da2b4                      0.0s
 => => exporting manifest list sha256:8f4270fecb1326a63d5d96324cc4f0a31378b6c4df2b37547389cb19f8461b94                             0.0s
 => => naming to docker.io/library/mtls-server:latest                                                                              0.0s
 => => unpacking to docker.io/library/mtls-server:latest                                                                           0.0s

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/jsinrya465wn76nlbdcbje53e
[+] Building 0.2s (8/8) FINISHED                                                                                   docker:desktop-linux
 => [internal] load build definition from Dockerfile                                                                               0.0s
 => => transferring dockerfile: 116B                                                                                               0.0s
 => [internal] load metadata for docker.io/library/node:18-alpine                                                                  0.0s
 => [internal] load .dockerignore                                                                                                  0.0s
 => => transferring context: 2B                                                                                                    0.0s
 => [1/3] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e            0.0s
 => => resolve docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e            0.0s
 => [internal] load build context                                                                                                  0.0s
 => => transferring context: 827B                                                                                                  0.0s
 => CACHED [2/3] WORKDIR /app                                                                                                      0.0s
 => [3/3] COPY client.js .                                                                                                         0.0s
 => exporting to image                                                                                                             0.1s
 => => exporting layers                                                                                                            0.0s
 => => exporting manifest sha256:ac276f655c9c5ebd902b4fdf6072da54b4a905005fbfd762f9560f0ca38d46e2                                  0.0s
 => => exporting config sha256:b5198adcc035631be378c254ab5e318c0ed25999d6ba3e4b9f9db3c1c38ab6e2                                    0.0s
 => => exporting attestation manifest sha256:c02662d1423d1484d3e90e202a91bec59199795b40578ea2cef2eecf7b8a1aac                      0.0s
 => => exporting manifest list sha256:59b28f10124235a21797de6c98db91b25899b1a48ea7490d5af8ace06638301d                             0.0s
 => => naming to docker.io/library/mtls-client:latest                                                                              0.0s
 => => unpacking to docker.io/library/mtls-client:latest                                                                           0.0s

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/l7ikkqzz6tt8mnj85wemrgyi5
keerthana@Mac-1107 mtls-poc % docker images | grep mtls
mtls-client:latest                                                                                      59b28f101242        180MB  44.9MB        
mtls-server:latest                                                                                      8f4270fecb13        180MB  44.9MB        
keerthana@Mac-1107 mtls-poc % minikube image load mtls-server:latest

minikube image load mtls-client:latest
keerthana@Mac-1107 mtls-poc % minikube image ls | grep mtls
docker.io/library/mtls-server:latest
docker.io/library/mtls-client:latest
keerthana@Mac-1107 mtls-poc % kubectl create namespace mtls-poc
namespace/mtls-poc created
keerthana@Mac-1107 mtls-poc % kubectl get namespaces
NAME              STATUS   AGE
default           Active   14m
kube-node-lease   Active   14m
kube-public       Active   14m
kube-system       Active   14m
mtls-poc          Active   3s
keerthana@Mac-1107 mtls-poc % kubectl create secret generic mtls-server-certs \
  --namespace mtls-poc \
  --from-file=server.key=./certs/server.key \
  --from-file=server.crt=./certs/server.crt \
  --from-file=ca.crt=./certs/ca.crt
secret/mtls-server-certs created
keerthana@Mac-1107 mtls-poc % kubectl create secret generic mtls-client-certs \
  --namespace mtls-poc \
  --from-file=client.key=./certs/client.key \
  --from-file=client.crt=./certs/client.crt \
  --from-file=ca.crt=./certs/ca.crt
secret/mtls-client-certs created
keerthana@Mac-1107 mtls-poc % kubectl get secrets -n mtls-poc
NAME                TYPE     DATA   AGE
mtls-client-certs   Opaque   3      20s
mtls-server-certs   Opaque   3      24s
keerthana@Mac-1107 mtls-poc % kubectl describe secret mtls-server-certs -n mtls-poc

kubectl describe secret mtls-client-certs -n mtls-poc
Name:         mtls-server-certs
Namespace:    mtls-poc
Labels:       <none>
Annotations:  <none>

Type:  Opaque

Data
====
ca.crt:      1675 bytes
server.crt:  1452 bytes
server.key:  1679 bytes
Name:         mtls-client-certs
Namespace:    mtls-poc
Labels:       <none>
Annotations:  <none>

Type:  Opaque

Data
====
ca.crt:      1675 bytes
client.crt:  1403 bytes
client.key:  1675 bytes
keerthana@Mac-1107 mtls-poc % 
keerthana@Mac-1107 mtls-poc % >....                                                                                                     
  template:
    metadata:
      labels:
        app: mtls-server
    spec:
      containers:
        - name: mtls-server
          image: mtls-server:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 3001
          volumeMounts:
            - name: mtls-certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: mtls-certs
          secret:
            secretName: mtls-server-certs
EOF
keerthana@Mac-1107 mtls-poc % kubectl apply -f server-deployment.yaml
deployment.apps/mtls-server created
keerthana@Mac-1107 mtls-poc % kubectl get deployments,pods -n mtls-poc -o wide
NAME                          READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS    IMAGES               SELECTOR
deployment.apps/mtls-server   1/1     1            1           5s    mtls-server   mtls-server:latest   app=mtls-server

NAME                               READY   STATUS    RESTARTS   AGE   IP           NODE       NOMINATED NODE   READINESS GATES
pod/mtls-server-6c484ddd67-x2kn7   1/1     Running   0          5s    10.244.0.3   minikube   <none>           <none>
keerthana@Mac-1107 mtls-poc % kubectl logs deployment/mtls-server -n mtls-poc
mTLS server listening on port 3001
keerthana@Mac-1107 mtls-poc % cat > server-service.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: mtls-server
  namespace: mtls-poc
spec:
  selector:
    app: mtls-server
  ports:
    - protocol: TCP
      port: 3001
      targetPort: 3001
EOF
keerthana@Mac-1107 mtls-poc % kubectl apply -f server-service.yaml
service/mtls-server created
keerthana@Mac-1107 mtls-poc % kubectl get service -n mtls-poc

kubectl get endpoints -n mtls-poc
NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
mtls-server   ClusterIP   10.102.51.237   <none>        3001/TCP   5s
Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice
NAME          ENDPOINTS         AGE
mtls-server   10.244.0.3:3001   5s
keerthana@Mac-1107 mtls-poc % kubectl run dns-test \
  --rm \
  -it \
  --restart=Never \
  --image=busybox:1.36 \
  -n mtls-poc \
  -- nslookup mtls-server
Server:         10.96.0.10
Address:        10.96.0.10:53

** server can't find mtls-server.svc.cluster.local: NXDOMAIN

** server can't find mtls-server.cluster.local: NXDOMAIN

** server can't find mtls-server.cluster.local: NXDOMAIN

Name:   mtls-server.mtls-poc.svc.cluster.local
Address: 10.102.51.237

** server can't find mtls-server.svc.cluster.local: NXDOMAIN


pod "dns-test" deleted from mtls-poc namespace
pod mtls-poc/dns-test terminated (Error)
keerthana@Mac-1107 mtls-poc % >....                                                                                                     
    metadata:
      labels:
        app: mtls-client
    spec:
      containers:
        - name: mtls-client
          image: mtls-client:latest
          imagePullPolicy: Never
          env:
            - name: USE_CLIENT_CERT
              value: "true"
          volumeMounts:
            - name: mtls-certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: mtls-certs
          secret:
            secretName: mtls-client-certs
EOF
keerthana@Mac-1107 mtls-poc % kubectl apply -f client-deployment.yaml
deployment.apps/mtls-client created
keerthana@Mac-1107 mtls-poc % kubectl get pods -n mtls-poc -o wide
NAME                           READY   STATUS      RESTARTS     AGE   IP           NODE       NOMINATED NODE   READINESS GATES
mtls-client-766d66464b-pzhxb   0/1     Completed   1 (3s ago)   3s    10.244.0.5   minikube   <none>           <none>
mtls-server-6c484ddd67-x2kn7   1/1     Running     0            98s   10.244.0.3   minikube   <none>           <none>
keerthana@Mac-1107 mtls-poc % kubectl get deployments -n mtls-poc
NAME          READY   UP-TO-DATE   AVAILABLE   AGE
mtls-client   0/1     1            0           11s
mtls-server   1/1     1            1           106s
keerthana@Mac-1107 mtls-poc % kubectl get deployments -n mtls-poc -f
error: flag needs an argument: 'f' in -f
See 'kubectl get --help' for usage.
keerthana@Mac-1107 mtls-poc % kubectl get deployments -n mtls-poc   
NAME          READY   UP-TO-DATE   AVAILABLE   AGE
mtls-client   0/1     1            0           28s
mtls-server   1/1     1            1           2m3s
keerthana@Mac-1107 mtls-poc % kubectl get deployments -n mtls-poc -f
error: flag needs an argument: 'f' in -f
See 'kubectl get --help' for usage.
keerthana@Mac-1107 mtls-poc % kubectl get deployments -n mtls-poc   
NAME          READY   UP-TO-DATE   AVAILABLE   AGE
mtls-client   0/1     1            0           35s
mtls-server   1/1     1            1           2m10s
keerthana@Mac-1107 mtls-poc % kubectl get pods -n mtls-poc -o wide
NAME                           READY   STATUS      RESTARTS      AGE     IP           NODE       NOMINATED NODE   READINESS GATES
mtls-client-766d66464b-pzhxb   0/1     Completed   2 (38s ago)   39s     10.244.0.5   minikube   <none>           <none>
mtls-server-6c484ddd67-x2kn7   1/1     Running     0             2m14s   10.244.0.3   minikube   <none>           <none>
keerthana@Mac-1107 mtls-poc % kubectl logs deployment/mtls-client -n mtls-poc
Client certificate: ENABLED
HTTP status: 200
Response: mTLS connection successful

keerthana@Mac-1107 mtls-poc % kubectl logs deployment/mtls-server -n mtls-poc
mTLS server listening on port 3001
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
keerthana@Mac-1107 mtls-poc % SERVER_POD=$(kubectl get pod \
  -n mtls-poc \
  -l app=mtls-server \
  -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n mtls-poc "$SERVER_POD" -- ls -l /certs
total 0
lrwxrwxrwx    1 root     root            13 Oct  8 09:08 ca.crt -> ..data/ca.crt
lrwxrwxrwx    1 root     root            17 Oct  8 09:08 server.crt -> ..data/server.crt
lrwxrwxrwx    1 root     root            17 Oct  8 09:08 server.key -> ..data/server.key
keerthana@Mac-1107 mtls-poc % CLIENT_POD=$(kubectl get pod \
  -n mtls-poc \
  -l app=mtls-client \
  -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n mtls-poc "$CLIENT_POD" -- ls -l /certs
error: Internal error occurred: unable to upgrade connection: container not found ("mtls-client")
keerthana@Mac-1107 mtls-poc % kubectl get all -n mtls-poc
NAME                               READY   STATUS             RESTARTS        AGE
pod/mtls-client-766d66464b-pzhxb   0/1     CrashLoopBackOff   6 (4m24s ago)   10m
pod/mtls-server-6c484ddd67-x2kn7   1/1     Running            0               11m

NAME                  TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
service/mtls-server   ClusterIP   10.102.51.237   <none>        3001/TCP   11m

NAME                          READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/mtls-client   0/1     1            0           10m
deployment.apps/mtls-server   1/1     1            1           11m

NAME                                     DESIRED   CURRENT   READY   AGE
replicaset.apps/mtls-client-766d66464b   1         1         0       10m
replicaset.apps/mtls-server-6c484ddd67   1         1         1       11m
keerthana@Mac-1107 mtls-poc % kubectl get secrets -n mtls-poc

kubectl get service -n mtls-poc

kubectl get endpoints -n mtls-poc

kubectl get pods -n mtls-poc -o wide
NAME                TYPE     DATA   AGE
mtls-client-certs   Opaque   3      14m
mtls-server-certs   Opaque   3      14m
NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
mtls-server   ClusterIP   10.102.51.237   <none>        3001/TCP   11m
Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice
NAME          ENDPOINTS         AGE
mtls-server   10.244.0.3:3001   11m
NAME                           READY   STATUS             RESTARTS        AGE   IP           NODE       NOMINATED NODE   READINESS GATES
mtls-client-766d66464b-pzhxb   0/1     CrashLoopBackOff   6 (4m28s ago)   10m   10.244.0.5   minikube   <none>           <none>
mtls-server-6c484ddd67-x2kn7   1/1     Running            0               11m   10.244.0.3   minikube   <none>           <none>
keerthana@Mac-1107 mtls-poc % echo "========== CLUSTER =========="
kubectl get nodes -o wide

echo "========== ALL RESOURCES =========="
kubectl get all -n mtls-poc

echo "========== SECRETS =========="
kubectl get secrets -n mtls-poc

echo "========== SERVICES =========="
kubectl get svc -n mtls-poc

echo "========== ENDPOINTS =========="
kubectl get endpoints -n mtls-poc

echo "========== SERVER LOG =========="
kubectl logs deployment/mtls-server -n mtls-poc

echo "========== CLIENT LOG =========="
kubectl logs deployment/mtls-client -n mtls-poc
========== CLUSTER ==========
NAME       STATUS   ROLES           AGE   VERSION   INTERNAL-IP    EXTERNAL-IP   OS-IMAGE                         KERNEL-VERSION    CONTAINER-RUNTIME
minikube   Ready    control-plane   30m   v1.35.1   192.168.49.2   <none>        Debian GNU/Linux 12 (bookworm)   7.0.12-linuxkit   docker://29.2.1
========== ALL RESOURCES ==========
NAME                               READY   STATUS             RESTARTS        AGE
pod/mtls-client-766d66464b-pzhxb   0/1     CrashLoopBackOff   6 (4m39s ago)   10m
pod/mtls-server-6c484ddd67-x2kn7   1/1     Running            0               12m

NAME                  TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
service/mtls-server   ClusterIP   10.102.51.237   <none>        3001/TCP   11m

NAME                          READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/mtls-client   0/1     1            0           10m
deployment.apps/mtls-server   1/1     1            1           12m

NAME                                     DESIRED   CURRENT   READY   AGE
replicaset.apps/mtls-client-766d66464b   1         1         0       10m
replicaset.apps/mtls-server-6c484ddd67   1         1         1       12m
========== SECRETS ==========
NAME                TYPE     DATA   AGE
mtls-client-certs   Opaque   3      15m
mtls-server-certs   Opaque   3      15m
========== SERVICES ==========
NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
mtls-server   ClusterIP   10.102.51.237   <none>        3001/TCP   11m
========== ENDPOINTS ==========
Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice
NAME          ENDPOINTS         AGE
mtls-server   10.244.0.3:3001   11m
========== SERVER LOG ==========
mTLS server listening on port 3001
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
========== CLIENT LOG ==========
Client certificate: ENABLED
HTTP status: 200
Response: mTLS connection successful

keerthana@Mac-1107 mtls-poc % 
keerthana@Mac-1107 mtls-poc % 
keerthana@Mac-1107 mtls-poc % >....                                                                                                     
        ],
        "volumeMounts": [
          {
            "name": "mtls-certs",
            "mountPath": "/certs",
            "readOnly": true
          }
        ]
      }
    ],
    "volumes": [
      {
        "name": "mtls-certs",
        "secret": {
          "secretName": "mtls-client-certs"
        }
      }
    ]
  }
}'
pod/mtls-client-test created
keerthana@Mac-1107 mtls-poc % kubectl logs -n mtls-poc mtls-client-test
Client certificate: ENABLED
HTTP status: 200
Response: mTLS connection successful

keerthana@Mac-1107 mtls-poc % kubectl logs deployment/mtls-server -n mtls-poc --tail=10
mTLS server listening on port 3001
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
keerthana@Mac-1107 mtls-poc % kubectl logs deployment/mtls-server -n mtls-poc --tail=10
mTLS server listening on port 3001
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
Client certificate subject: [Object: null prototype] { CN: 'mtls-client' }
keerthana@Mac-1107 mtls-poc % 

---

# Phase 3A — Minikube Kubernetes mTLS POC

## 1. Go to your existing POC

```bash
cd /Users/keerthana/Desktop/mtls-poc

pwd
ls
ls server
ls client
ls certs
```

You should have:

```text
server/
client/
certs/
```

---

## 2. Start a clean Minikube cluster

This gives us a clean Kubernetes environment for today's evaluation.

```bash
minikube delete

minikube start --driver=docker
```

Then verify:

```bash
minikube status

kubectl get nodes -o wide

kubectl get pods -A
```

Expected:

```text
minikube   Running
```

and the node should show:

```text
Ready
```

---

# 3. Build the existing mTLS images

Use your existing Dockerfiles. **Do not modify the application.**

```bash
docker build -t mtls-server:latest ./server

docker build -t mtls-client:latest ./client
```

Verify:

```bash
docker images | grep mtls
```

---

# 4. Load the images into Minikube

Because Kubernetes is running inside the Minikube environment, make the locally built images available to it:

```bash
minikube image load mtls-server:latest

minikube image load mtls-client:latest
```

Verify:

```bash
minikube image ls | grep mtls
```

---

# 5. Create a Kubernetes namespace

Keep today's POC isolated:

```bash
kubectl create namespace mtls-poc
```

Verify:

```bash
kubectl get namespaces
```

---

# 6. Create Kubernetes Secrets for certificates

This is an important part of today's evaluation.

We are **not baking private keys into the container images**.

Create the server Secret:

```bash
kubectl create secret generic mtls-server-certs \
  --namespace mtls-poc \
  --from-file=server.key=./certs/server.key \
  --from-file=server.crt=./certs/server.crt \
  --from-file=ca.crt=./certs/ca.crt
```

Create the client Secret:

```bash
kubectl create secret generic mtls-client-certs \
  --namespace mtls-poc \
  --from-file=client.key=./certs/client.key \
  --from-file=client.crt=./certs/client.crt \
  --from-file=ca.crt=./certs/ca.crt
```

Verify:

```bash
kubectl get secrets -n mtls-poc
```

You should see:

```text
mtls-server-certs
mtls-client-certs
```

Check that Kubernetes knows the keys without printing their contents:

```bash
kubectl describe secret mtls-server-certs -n mtls-poc

kubectl describe secret mtls-client-certs -n mtls-poc
```

**Do not run commands that print the decoded private keys.**

---

# 7. Create the server Deployment

Create the manifest:

```bash
cat > server-deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mtls-server
  namespace: mtls-poc
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mtls-server
  template:
    metadata:
      labels:
        app: mtls-server
    spec:
      containers:
        - name: mtls-server
          image: mtls-server:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 3001
          volumeMounts:
            - name: mtls-certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: mtls-certs
          secret:
            secretName: mtls-server-certs
EOF
```

Apply it:

```bash
kubectl apply -f server-deployment.yaml
```

Check:

```bash
kubectl get deployments,pods -n mtls-poc -o wide
```

Then:

```bash
kubectl logs deployment/mtls-server -n mtls-poc
```

Expected:

```text
mTLS server listening on port 3001
```

---

# 8. Create the Kubernetes Service

This is the important networking change from Podman.

Create:

```bash
cat > server-service.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: mtls-server
  namespace: mtls-poc
spec:
  selector:
    app: mtls-server
  ports:
    - protocol: TCP
      port: 3001
      targetPort: 3001
EOF
```

Apply:

```bash
kubectl apply -f server-service.yaml
```

Check:

```bash
kubectl get service -n mtls-poc

kubectl get endpoints -n mtls-poc
```

You should see the `mtls-server` Service and an endpoint pointing to the server Pod.

---

# 9. Verify the Service DNS

Your existing client code uses:

```text
mtls-server
```

The Kubernetes Service is also named:

```text
mtls-server
```

So the existing code:

```js
hostname: 'mtls-server'
```

doesn't need to change.

Run a temporary DNS test:

```bash
kubectl run dns-test \
  --rm \
  -it \
  --restart=Never \
  --image=busybox:1.36 \
  -n mtls-poc \
  -- nslookup mtls-server
```

You should get a Kubernetes Service address.

This proves:

```text
Client Pod
    │
    │ Kubernetes DNS
    ▼
mtls-server
```

---

# 10. Create the client Deployment

Now create the client:

```bash
cat > client-deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mtls-client
  namespace: mtls-poc
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mtls-client
  template:
    metadata:
      labels:
        app: mtls-client
    spec:
      containers:
        - name: mtls-client
          image: mtls-client:latest
          imagePullPolicy: Never
          env:
            - name: USE_CLIENT_CERT
              value: "true"
          volumeMounts:
            - name: mtls-certs
              mountPath: /certs
              readOnly: true
      volumes:
        - name: mtls-certs
          secret:
            secretName: mtls-client-certs
EOF
```

Apply:

```bash
kubectl apply -f client-deployment.yaml
```

---

# 11. Watch the Pods

```bash
kubectl get pods -n mtls-poc -o wide
```

Wait until both are:

```text
Running
```

Then:

```bash
kubectl get deployments -n mtls-poc
```

Expected:

```text
mtls-server   1/1
mtls-client   1/1
```

---

# 12. Check the client result — this is the main test

Run:

```bash
kubectl logs deployment/mtls-client -n mtls-poc
```

Expected:

```text
Client certificate: ENABLED
HTTP status: 200
Response: mTLS connection successful
```

This proves the full path:

```text
Client Pod
    │
    │ HTTPS
    │
    │ client certificate
    ▼
mtls-server Service
    │
    ▼
Server Pod
    │
    │ verifies client certificate
    ▼
mTLS successful
```

---

# 13. Check server logs

```bash
kubectl logs deployment/mtls-server -n mtls-poc
```

You should see something similar to:

```text
mTLS server listening on port 3001
Client certificate subject: ...
```

This is especially useful because it proves the server actually received and accepted the client's certificate.

---

# 14. Verify the certificate files are mounted from Secrets

Check the server Pod:

```bash
SERVER_POD=$(kubectl get pod \
  -n mtls-poc \
  -l app=mtls-server \
  -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n mtls-poc "$SERVER_POD" -- ls -l /certs
```

Expected:

```text
ca.crt
server.crt
server.key
```

Client:

```bash
CLIENT_POD=$(kubectl get pod \
  -n mtls-poc \
  -l app=mtls-client \
  -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n mtls-poc "$CLIENT_POD" -- ls -l /certs
```

Expected:

```text
ca.crt
client.crt
client.key
```

This demonstrates:

```text
Kubernetes Secret
       │
       ▼
Pod volume
       │
       ▼
/certs
```

---

# 15. Verify Kubernetes objects together

Run:

```bash
kubectl get all -n mtls-poc
```

Then:

```bash
kubectl get secrets -n mtls-poc

kubectl get service -n mtls-poc

kubectl get endpoints -n mtls-poc

kubectl get pods -n mtls-poc -o wide
```

---

# 16. Final architecture check

At the end, your Minikube POC should look like:

```text
                       MINIKUBE
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Namespace: mtls-poc                                │
│                                                     │
│   ┌────────────────┐                                │
│   │ Client Pod     │                                │
│   │                │                                │
│   │ client.js      │                                │
│   │ client.key     │◄──── Client Secret             │
│   │ client.crt     │                                │
│   │ ca.crt         │                                │
│   └───────┬────────┘                                │
│           │                                         │
│           │ HTTPS + mTLS                            │
│           │ https://mtls-server:3001                │
│           ▼                                         │
│   ┌────────────────┐                                │
│   │ Service        │                                │
│   │ mtls-server    │                                │
│   │ :3001          │                                │
│   └───────┬────────┘                                │
│           │                                         │
│           ▼                                         │
│   ┌────────────────┐                                │
│   │ Server Pod     │                                │
│   │                │                                │
│   │ server.js      │                                │
│   │ server.key     │◄──── Server Secret             │
│   │ server.crt     │                                │
│   │ ca.crt         │                                │
│   └────────────────┘                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 17. Final evaluation evidence

Once everything works, collect this **one final output**:

```bash
echo "========== CLUSTER =========="
kubectl get nodes -o wide

echo "========== ALL RESOURCES =========="
kubectl get all -n mtls-poc

echo "========== SECRETS =========="
kubectl get secrets -n mtls-poc

echo "========== SERVICES =========="
kubectl get svc -n mtls-poc

echo "========== ENDPOINTS =========="
kubectl get endpoints -n mtls-poc

echo "========== SERVER LOG =========="
kubectl logs deployment/mtls-server -n mtls-poc

echo "========== CLIENT LOG =========="
kubectl logs deployment/mtls-client -n mtls-poc
```

### Your success criteria today

```text
✓ Minikube cluster running
✓ Existing mTLS images running as Kubernetes Pods
✓ Kubernetes Secrets hold certificate/key material
✓ Server exposed through Kubernetes Service
✓ Kubernetes DNS resolves mtls-server
✓ Client reaches server through Service
✓ Server certificate verified
✓ Client certificate verified
✓ mTLS handshake succeeds
✓ HTTP 200 returned
✓ No application-code changes required
```

1. Negative: client certificate disabled:
keerthana@Mac-1107 mtls-poc % >....                                                                                                     
        ],
        "volumeMounts": [
          {
            "name": "mtls-certs",
            "mountPath": "/certs",
            "readOnly": true
          }
        ]
      }
    ],
    "volumes": [
      {
        "name": "mtls-certs",
        "secret": {
          "secretName": "mtls-client-certs"
        }
      }
    ]
  }
}'
pod/mtls-negative-no-cert created
keerthana@Mac-1107 mtls-poc % kubectl logs -n mtls-poc mtls-negative-no-cert
Client certificate: DISABLED
mTLS request failed: A0ECCEA1FFFF0000:error:0A00045C:SSL routines:ssl3_read_bytes:tlsv13 alert certificate required:../deps/openssl/openssl/ssl/record/rec_layer_s3.c:1605:SSL alert number 116

keerthana@Mac-1107 mtls-poc % 

2. Negative: untrusted client certificate:
keerthana@Mac-1107 mtls-poc % mkdir -p k8s-negative-bad-client

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout k8s-negative-bad-client/bad-ca.key \
  -out k8s-negative-bad-client/bad-ca.crt \
  -days 365 \
  -subj "/CN=BAD-MTLS-CA"

openssl req -newkey rsa:2048 -nodes \
  -keyout k8s-negative-bad-client/client.key \
  -out k8s-negative-bad-client/client.csr \
  -subj "/CN=bad-client"

openssl x509 -req \
  -in k8s-negative-bad-client/client.csr \
  -CA k8s-negative-bad-client/bad-ca.crt \
  -CAkey k8s-negative-bad-client/bad-ca.key \
  -CAcreateserial \
  -out k8s-negative-bad-client/client.crt \
  -days 365
Generating a 2048 bit RSA private key
.......................+++++
............+++++
writing new private key to 'k8s-negative-bad-client/bad-ca.key'
-----
Generating a 2048 bit RSA private key
.......................................................+++++
............+++++
writing new private key to 'k8s-negative-bad-client/client.key'
-----
Signature ok
subject=/CN=bad-client
Getting CA Private Key
keerthana@Mac-1107 mtls-poc % kubectl create secret generic mtls-bad-client-certs \
  -n mtls-poc \
  --from-file=client.key=k8s-negative-bad-client/client.key \
  --from-file=client.crt=k8s-negative-bad-client/client.crt \
  --from-file=ca.crt=./certs/ca.crt
secret/mtls-bad-client-certs created
keerthana@Mac-1107 mtls-poc % >....                                                                                                     
        ],
        "volumeMounts": [
          {
            "name": "mtls-certs",
            "mountPath": "/certs",
            "readOnly": true
          }
        ]
      }
    ],
    "volumes": [
      {
        "name": "mtls-certs",
        "secret": {
          "secretName": "mtls-bad-client-certs"
        }
      }
    ]
  }
}'
pod/mtls-negative-bad-client created
keerthana@Mac-1107 mtls-poc % kubectl logs -n mtls-poc mtls-negative-bad-client
Client certificate: ENABLED
mTLS request failed: socket hang up
keerthana@Mac-1107 mtls-poc % 

* Untrusted client test:
We create a fake client certificate:

BAD-MTLS-CA
     ↓ signs
bad-client.crt

But the server trusts only:
MTLS-POC-CA

So:                                                                                                                        -->*important point*
----
Client → sends bad-client.crt
              ↓
Server checks:
"Was this certificate signed by my trusted CA?"
              ↓
          NO ❌
              ↓
      Reject connection

* After both tests :: Clean up only the temporary negative-test resources:
kubectl delete pod mtls-negative-no-cert mtls-negative-bad-client -n mtls-poc
kubectl delete secret mtls-bad-client-certs -n mtls-poc
rm -rf k8s-negative-bad-client

