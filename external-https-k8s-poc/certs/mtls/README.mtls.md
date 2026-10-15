keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % cd /Users/keerthana/Desktop/external-https-k8s-poc

kubectl get pods -n ingress-nginx
kubectl get ingress -n external-https-poc
kubectl get secret demo-tls -n external-https-poc
NAME                                        READY   STATUS      RESTARTS   AGE
ingress-nginx-admission-create-84kwr        0/1     Completed   0          17m
ingress-nginx-admission-patch-fxj7k         0/1     Completed   0          17m
ingress-nginx-controller-596f8778bc-2hgdj   1/1     Running     0          17m
NAME       CLASS   HOSTS        ADDRESS        PORTS     AGE
demo-web   nginx   demo.local   192.168.49.2   80, 443   16m
NAME       TYPE                DATA   AGE
demo-tls   kubernetes.io/tls   2      16m
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % 
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % 
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % >....                                                                                                                                                
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
SCRIPT

chmod +x setup-mtls.sh
./setup-mtls.sh
1. Creating the Certificate Authority (CA)
Generating a 2048 bit RSA private key
.......+++++
...........+++++
writing new private key to 'ca.key'
-----
2. Creating the server certificate for demo.local
Generating a 2048 bit RSA private key
...+++++
.......................................................+++++
writing new private key to 'server.key'
-----
Signature ok
subject=/CN=demo.local
Getting CA Private Key
3. Creating the client certificate
Generating a 2048 bit RSA private key
............................+++++
....................................................+++++
writing new private key to 'client.key'
-----
Signature ok
subject=/CN=external-test-client
Getting CA Private Key
4. Updating the server TLS Secret
secret/demo-tls configured
5. Creating the CA Secret used to verify client certificates
secret/demo-client-ca created
6. Requiring client certificates at the Ingress
ingress.networking.k8s.io/demo-web annotated
7. Waiting for the Ingress controller to reload
NAME       CLASS   HOSTS        ADDRESS        PORTS     AGE
demo-web   nginx   demo.local   192.168.49.2   80, 443   17m
NAME             TYPE                DATA   AGE
demo-tls         kubernetes.io/tls   2      17m
demo-client-ca   Opaque              1      4s

SETUP COMPLETE
Certificates are in: certs/mtls/
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % 

**Actual script**:
cat > setup-mtls.sh <<'SCRIPT'
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
SCRIPT

chmod +x setup-mtls.sh
./setup-mtls.sh

keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % curl --resolve demo.local:443:127.0.0.1 \
  --cacert certs/mtls/ca.crt \
  --cert certs/mtls/client.crt \
  --key certs/mtls/client.key \
  -w '\nHTTP status: %{http_code}\n' \
  https://demo.local/
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, nginx is successfully installed and working.
Further configuration is required for the web server, reverse proxy, 
API gateway, load balancer, content cache, or other features.</p>

<p>For online documentation and support please refer to
<a href="https://nginx.org/">nginx.org</a>.<br/>
To engage with the community please visit
<a href="https://community.nginx.org/">community.nginx.org</a>.<br/>
For enterprise grade support, professional services, additional 
security features and capabilities please refer to
<a href="https://f5.com/nginx">f5.com/nginx</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>

HTTP status: 200
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % curl --resolve demo.local:443:127.0.0.1 \
  --cacert certs/mtls/ca.crt \
  -w '\nHTTP status: %{http_code}\n' \
  https://demo.local/
<html>
<head><title>400 No required SSL certificate was sent</title></head>
<body>
<center><h1>400 Bad Request</h1></center>
<center>No required SSL certificate was sent</center>
<hr><center>nginx</center>
</body>
</html>

HTTP status: 400
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % mkdir -p certs/mtls/untrusted
cd certs/mtls/untrusted

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout rogue-ca.key -out rogue-ca.crt -days 30 \
  -subj "/CN=Untrusted-CA"

openssl req -new -newkey rsa:2048 -nodes \
  -keyout rogue-client.key -out rogue-client.csr \
  -subj "/CN=untrusted-client"

cat > client.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature
extendedKeyUsage=clientAuth
EOF

openssl x509 -req -in rogue-client.csr \
  -CA rogue-ca.crt -CAkey rogue-ca.key -CAcreateserial \
  -out rogue-client.crt -days 30 -sha256 -extfile client.ext

cd ../..

curl --resolve demo.local:443:127.0.0.1 \
  --cacert certs/mtls/ca.crt \
  --cert certs/mtls/untrusted/rogue-client.crt \
  --key certs/mtls/untrusted/rogue-client.key \
  -w '\nHTTP status: %{http_code}\n' \
  https://demo.local/
Generating a 2048 bit RSA private key
.........................................+++++
...........................................+++++
writing new private key to 'rogue-ca.key'
-----
Generating a 2048 bit RSA private key
.....................................................+++++
............................+++++
writing new private key to 'rogue-client.key'
-----
Signature ok
subject=/CN=untrusted-client
Getting CA Private Key
curl: (58) could not load PEM client certificate from certs/mtls/untrusted/rogue-client.crt, LibreSSL error error:02FFF002:system library:func(4095):No such file or directory, (no key found, wrong pass phrase, or wrong file format?)

HTTP status: 000
keerthana@Keerthanas-MacBook-Air certs % 
keerthana@Keerthanas-MacBook-Air certs % cd /Users/keerthana/Desktop/external-https-k8s-poc

ls -l certs/mtls/untrusted/rogue-client.crt \
      certs/mtls/untrusted/rogue-client.key

curl --resolve demo.local:443:127.0.0.1 \
  --cacert certs/mtls/ca.crt \
  --cert certs/mtls/untrusted/rogue-client.crt \
  --key certs/mtls/untrusted/rogue-client.key \
  -w '\nHTTP status: %{http_code}\n' \
  https://demo.local/
-rw-r--r--  1 keerthana  staff  1062 15 Oct 10:26 certs/mtls/untrusted/rogue-client.crt
-rw-r--r--  1 keerthana  staff  1704 15 Oct 10:26 certs/mtls/untrusted/rogue-client.key
<html>
<head><title>400 The SSL certificate error</title></head>
<body>
<center><h1>400 Bad Request</h1></center>
<center>The SSL certificate error</center>
<hr><center>nginx</center>
</body>
</html>

HTTP status: 400
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % 
