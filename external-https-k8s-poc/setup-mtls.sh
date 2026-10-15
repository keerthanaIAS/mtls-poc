#!/bin/bash
set -euo pipefail

NS="external-https-poc"
DIR="certs/mtls"

mkdir -p "$DIR"
cd "$DIR"

echo "1. Creating the Certificate Authority (CA)"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ca.key -out ca.crt -days 365 -sha256 \
  -subj "/CN=External-mTLS-POC-CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"

echo "2. Creating the server certificate for demo.local"
openssl req -new -newkey rsa:2048 -nodes \
  -keyout server.key -out server.csr \
  -subj "/CN=demo.local"

cat > server.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:demo.local
EOF

openssl x509 -req -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 365 -sha256 -extfile server.ext

echo "3. Creating the client certificate"
openssl req -new -newkey rsa:2048 -nodes \
  -keyout client.key -out client.csr \
  -subj "/CN=external-test-client"

cat > client.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature
extendedKeyUsage=clientAuth
EOF

openssl x509 -req -in client.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt -days 365 -sha256 -extfile client.ext

cd ../..

echo "4. Updating the server TLS Secret"
kubectl create secret tls demo-tls -n "$NS" \
  --cert="$DIR/server.crt" \
  --key="$DIR/server.key" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "5. Creating the CA Secret used to verify client certificates"
kubectl create secret generic demo-client-ca -n "$NS" \
  --from-file=ca.crt="$DIR/ca.crt" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "6. Requiring client certificates at the Ingress"
kubectl annotate ingress demo-web -n "$NS" \
  nginx.ingress.kubernetes.io/auth-tls-secret="$NS/demo-client-ca" \
  nginx.ingress.kubernetes.io/auth-tls-verify-client="on" \
  nginx.ingress.kubernetes.io/auth-tls-verify-depth="1" \
  --overwrite

echo "7. Waiting for the Ingress controller to reload"
sleep 3

kubectl get ingress demo-web -n "$NS"
kubectl get secret demo-tls demo-client-ca -n "$NS"

echo
echo "SETUP COMPLETE"
echo "Certificates are in: $DIR/"
