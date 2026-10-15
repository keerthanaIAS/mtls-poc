keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % minikube status || minikube start
kubectl get nodes
minikube
type: Control Plane
host: Stopped
kubelet: Stopped
apiserver: Stopped
kubeconfig: Stopped

😄  minikube v1.38.1 on Darwin 27.0.1 (arm64)
🎉  minikube 1.39.0 is available! Download it: https://github.com/kubernetes/minikube/releases/tag/v1.39.0
💡  To disable this notice, run: 'minikube config set WantUpdateNotification false'

✨  Using the docker driver based on existing profile
👍  Starting "minikube" primary control-plane node in "minikube" cluster
🚜  Pulling base image v0.0.50 ...
🔄  Restarting existing docker container for "minikube" ...
🐳  Preparing Kubernetes v1.35.1 on Docker 29.2.1 ...
🔎  Verifying Kubernetes components...
    ▪ Using image gcr.io/k8s-minikube/storage-provisioner:v5
🌟  Enabled addons: storage-provisioner, default-storageclass
🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
NAME       STATUS   ROLES           AGE     VERSION
minikube   Ready    control-plane   6d19h   v1.35.1
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
  -keyout certs/tls.key \
  -out certs/tls.crt \
  -subj "/CN=demo.local" \
  -addext "subjectAltName=DNS:demo.local"
Generating a 2048 bit RSA private key
................................+++++
.....+++++
writing new private key to 'certs/tls.key'
-----
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % minikube addons enable ingress

💡  ingress is an addon maintained by Kubernetes. For any concerns contact minikube on GitHub.
You can view the list of minikube maintainers at: https://github.com/kubernetes/minikube/blob/master/OWNERS
💡  After the addon is enabled, please run "minikube tunnel" and your ingress resources would be available at "127.0.0.1"
    ▪ Using image registry.k8s.io/ingress-nginx/controller:v1.14.3
    ▪ Using image registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.6.7
    ▪ Using image registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.6.7
🔎  Verifying ingress addon...
🌟  The 'ingress' addon is enabled
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % kubectl create namespace external-https-poc \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n external-https-poc create secret tls demo-tls \
  --cert=certs/tls.crt \
  --key=certs/tls.key \
  --dry-run=client -o yaml | kubectl apply -f -
namespace/external-https-poc created
secret/demo-tls created
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % cat > app.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-web
  namespace: external-https-poc
spec:
  replicas: 1
  selector:
    matchLabels:
      app: demo-web
  template:
    metadata:
      labels:
        app: demo-web
    spec:
      containers:
        - name: nginx
          image: nginx:alpine
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: demo-web
  namespace: external-https-poc
spec:
  selector:
    app: demo-web
  ports:
    - port: 80
      targetPort: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-web
  namespace: external-https-poc
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - demo.local
      secretName: demo-tls
  rules:
    - host: demo.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: demo-web
                port:
                  number: 80
EOF
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % kubectl apply -f app.yaml
deployment.apps/demo-web created
service/demo-web created
ingress.networking.k8s.io/demo-web created
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % kubectl -n external-https-poc rollout status deployment/demo-web \
  --timeout=120s
Waiting for deployment "demo-web" rollout to finish: 0 of 1 updated replicas are available...
deployment "demo-web" successfully rolled out
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % kubectl -n external-https-poc get pods,services,ingress,secrets
NAME                            READY   STATUS    RESTARTS   AGE
pod/demo-web-695b49ccb5-hzlnk   1/1     Running   0          14s

NAME               TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
service/demo-web   ClusterIP   10.98.43.247   <none>        80/TCP    14s

NAME                                 CLASS   HOSTS        ADDRESS   PORTS     AGE
ingress.networking.k8s.io/demo-web   nginx   demo.local             80, 443   14s

NAME              TYPE                DATA   AGE
secret/demo-tls   kubernetes.io/tls   2      33s
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % kubectl -n ingress-nginx get pods
NAME                                        READY   STATUS      RESTARTS   AGE
ingress-nginx-admission-create-84kwr        0/1     Completed   0          59s
ingress-nginx-admission-patch-fxj7k         0/1     Completed   0          59s
ingress-nginx-controller-596f8778bc-2hgdj   1/1     Running     0          59s
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % minikube ip
192.168.49.2
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % curl -vk --resolve demo.local:443:MINIKUBE_IP \
  https://demo.local/
* Resolve address 'MINIKUBE_IP' found illegal
* Couldn't parse CURLOPT_RESOLVE entry 'demo.local:443:MINIKUBE_IP'
curl: (49) Couldn't parse CURLOPT_RESOLVE entry 'demo.local:443:MINIKUBE_IP'
minikube tunnelLast login: Thu Oct 15 10:01:57 on ttys000

keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % minikube tunnel
✅  Tunnel successfully started

📌  NOTE: Please do not close this terminal as this process must stay alive for the tunnel to be accessible ...

❗  The service/ingress demo-web requires privileged ports to be exposed: [80 443]
🔑  sudo permission will be asked for it.
🔗  Starting tunnel for service demo-web.
Password:



keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % openssl s_client \
  -connect MINIKUBE_IP:443 \
  -servername demo.local \
  -showcerts </dev/null
getaddrinfo: nodename nor servname provided, or not known
connect:errno=0
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % openssl x509 -in certs/tls.crt \
  -noout -subject -issuer -dates -ext subjectAltName
unknown option -ext
usage: x509 [-C] [-addreject arg] [-addtrust arg] [-alias] [-CA file]
    [-CAcreateserial] [-CAform der | pem] [-CAkey file]
    [-CAkeyform der | pem] [-CAserial file] [-certopt option]
    [-checkend arg] [-clrext] [-clrreject] [-clrtrust] [-dates]
    [-days arg] [-email] [-enddate] [-extensions section]
    [-extfile file] [-fingerprint] [-hash] [-in file]
    [-inform der | net | pem] [-issuer] [-issuer_hash]
    [-issuer_hash_old] [-keyform der | pem] [-md5 | -sha1]
    [-modulus] [-nameopt option] [-next_serial] [-noout]
    [-ocsp_uri] [-ocspid] [-out file]
    [-outform der | net | pem] [-passin arg] [-pubkey]
    [-purpose] [-req] [-serial] [-set_serial n] [-setalias arg]
    [-signkey file] [-sigopt nm:v] [-startdate] [-subject]
    [-subject_hash] [-subject_hash_old] [-text] [-trustout]
    [-x509toreq]

 -C                 Convert the certificate into C code
 -addreject arg     Reject certificate for a given purpose
 -addtrust arg      Trust certificate for a given purpose
 -alias             Output certificate alias
 -CA file           CA certificate in PEM format unless -CAform is specified
 -CAcreateserial    Create serial number file if it does not exist
 -CAform fmt        CA format - default PEM
 -CAkey file        CA key in PEM format unless -CAkeyform is specified
                    if omitted, the key is assumed to be in the CA file
 -CAkeyform fmt     CA key format - default PEM
 -CAserial file     Serial file
 -certopt option    Various certificate text options
 -checkend arg      Check whether the cert expires in the next arg seconds
                    exit 1 if so, 0 if not
 -clrext            Clear all extensions
 -clrreject         Clear all rejected purposes
 -clrtrust          Clear all trusted purposes
 -dates             Both Before and After dates
 -days arg          How long till expiry of a signed certificate - def 30 days
 -email             Print email address(es)
 -enddate           Print notAfter field
 -extensions section
                    Section from config file with X509V3 extensions to add
 -extfile file      Configuration file with X509V3 extensions to add
 -fingerprint       Print the certificate fingerprint
 -hash              Synonym for -subject_hash
 -in file           Input file - default stdin
 -inform fmt        Input format - default PEM (one of DER, NET or PEM)
 -issuer            Print issuer name
 -issuer_hash       Print issuer hash value
 -issuer_hash_old   Print old-style (MD5) issuer hash value
 -keyform fmt       Private key format - default PEM
 -modulus           Print the RSA key modulus
 -nameopt option    Various certificate name options
 -next_serial       Print the next serial number
 -noout             No certificate output
 -ocsp_uri          Print OCSP Responder URL(s)
 -ocspid            Print OCSP hash values for the subject name and public key
 -out file          Output file - default stdout
 -outform fmt       Output format - default PEM (one of DER, NET or PEM)
 -passin src        Private key password source
 -pubkey            Output the public key
 -purpose           Print out certificate purposes
 -req               Input is a certificate request, sign and output
 -serial            Print serial number value
 -set_serial n      Serial number to use
 -setalias arg      Set certificate alias
 -signkey file      Self sign cert with arg
 -sigopt nm:v       Various signature algorithm options
 -startdate         Print notBefore field
 -subject           Print subject name
 -subject_hash      Print subject hash value
 -subject_hash_old  Print old-style (MD5) subject hash value
 -text              Print the certificate in text form
 -trustout          Output a trusted certificate
 -x509toreq         Output a certification request object

keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % curl --resolve demo.local:443:MINIKUBE_IP \
  --cacert certs/tls.crt \
  https://demo.local/
curl: (49) Couldn't parse CURLOPT_RESOLVE entry 'demo.local:443:MINIKUBE_IP'


keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % curl -vk --resolve demo.local:443:192.168.49.2 \
  https://demo.local/
* Added demo.local:443:192.168.49.2 to DNS cache
* Hostname demo.local was found in DNS cache
*   Trying 192.168.49.2:443...
* Connected to demo.local (192.168.49.2) port 443
* ALPN: curl offers h2,http/1.1
* (304) (OUT), TLS handshake, Client hello (1):
* Recv failure: Connection reset by peer
* LibreSSL/3.3.6: error:02FFF036:system library:func(4095):Connection reset by peer
* Closing connection
curl: (35) Recv failure: Connection reset by peer
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % curl -vk --resolve demo.local:443:127.0.0.1 \
  https://demo.local/
* Added demo.local:443:127.0.0.1 to DNS cache
* Hostname demo.local was found in DNS cache
*   Trying 127.0.0.1:443...
* Connected to demo.local (127.0.0.1) port 443
* ALPN: curl offers h2,http/1.1
* (304) (OUT), TLS handshake, Client hello (1):
* (304) (IN), TLS handshake, Server hello (2):
* (304) (IN), TLS handshake, Unknown (8):
* (304) (IN), TLS handshake, Certificate (11):
* (304) (IN), TLS handshake, CERT verify (15):
* (304) (IN), TLS handshake, Finished (20):
* (304) (OUT), TLS handshake, Finished (20):
* SSL connection using TLSv1.3 / AEAD-AES256-GCM-SHA384 / [blank] / UNDEF
* ALPN: server accepted h2
* Server certificate:
*  subject: CN=demo.local
*  start date: Oct 15 04:33:25 2026 GMT
*  expire date: Nov 14 04:33:25 2026 GMT
*  issuer: CN=demo.local
*  SSL certificate verify result: self signed certificate (18), continuing anyway.
* using HTTP/2
* [HTTP/2] [1] OPENED stream for https://demo.local/
* [HTTP/2] [1] [:method: GET]
* [HTTP/2] [1] [:scheme: https]
* [HTTP/2] [1] [:authority: demo.local]
* [HTTP/2] [1] [:path: /]
* [HTTP/2] [1] [user-agent: curl/8.7.1]
* [HTTP/2] [1] [accept: */*]
> GET / HTTP/2
> Host: demo.local
> User-Agent: curl/8.7.1
> Accept: */*
> 
* Request completely sent off
< HTTP/2 200 
< date: Thu, 15 Oct 2026 04:39:21 GMT
< content-type: text/html
< content-length: 896
< last-modified: Thu, 01 Oct 2026 23:04:20 GMT
< etag: "6abee6f4-380"
< accept-ranges: bytes
< 
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
* Connection #0 to host demo.local left intact


keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % kubectl -n ingress-nginx logs deploy/ingress-nginx-controller --tail=60
kubectl -n ingress-nginx get svc ingress-nginx-controller -o yaml
-------------------------------------------------------------------------------
NGINX Ingress controller
  Release:       v1.14.3
  Build:         b4ab41015421ae27f3a96d73f013183b7e166735
  Repository:    https://github.com/kubernetes/ingress-nginx
  nginx version: nginx/1.27.1

-------------------------------------------------------------------------------

W1015 04:33:49.556604       7 client_config.go:682] Neither --kubeconfig nor --master was specified.  Using the inClusterConfig.  This might not work.
I1015 04:33:49.556878       7 main.go:205] "Creating API client" host="https://10.96.0.1:443"
I1015 04:33:49.566458       7 main.go:248] "Running in Kubernetes cluster" major="1" minor="35" git="v1.35.1" state="clean" commit="8fea90b45245ef5c8ba54e7ae044d3e777c22500" platform="linux/arm64"
I1015 04:33:49.657125       7 main.go:101] "SSL fake certificate created" file="/etc/ingress-controller/ssl/default-fake-certificate.pem"
I1015 04:33:49.665295       7 ssl.go:535] "loading tls certificate" path="/usr/local/certificates/cert" key="/usr/local/certificates/key"
I1015 04:33:49.673542       7 nginx.go:273] "Starting NGINX Ingress controller"
I1015 04:33:49.678318       7 event.go:377] Event(v1.ObjectReference{Kind:"ConfigMap", Namespace:"ingress-nginx", Name:"ingress-nginx-controller", UID:"061fcb47-991a-4553-b51f-a106b51150e6", APIVersion:"v1", ResourceVersion:"25601", FieldPath:""}): type: 'Normal' reason: 'CREATE' ConfigMap ingress-nginx/ingress-nginx-controller
I1015 04:33:49.679758       7 event.go:377] Event(v1.ObjectReference{Kind:"ConfigMap", Namespace:"ingress-nginx", Name:"tcp-services", UID:"6f3ffcd4-49ac-4a30-8d4a-27bcf475c4d1", APIVersion:"v1", ResourceVersion:"25602", FieldPath:""}): type: 'Normal' reason: 'CREATE' ConfigMap ingress-nginx/tcp-services
I1015 04:33:49.679815       7 event.go:377] Event(v1.ObjectReference{Kind:"ConfigMap", Namespace:"ingress-nginx", Name:"udp-services", UID:"b320b8c3-09e3-45bb-9afd-3200ca9a024b", APIVersion:"v1", ResourceVersion:"25603", FieldPath:""}): type: 'Normal' reason: 'CREATE' ConfigMap ingress-nginx/udp-services
I1015 04:33:50.875748       7 nginx.go:319] "Starting NGINX process"
I1015 04:33:50.875899       7 leaderelection.go:258] "Attempting to acquire leader lease..." lock="ingress-nginx/ingress-nginx-leader"
I1015 04:33:50.876617       7 nginx.go:339] "Starting validation webhook" address=":8443" certPath="/usr/local/certificates/cert" keyPath="/usr/local/certificates/key"
I1015 04:33:50.877568       7 controller.go:217] "Configuration changes detected, backend reload required"
I1015 04:33:50.884753       7 leaderelection.go:272] "Successfully acquired lease" lock="ingress-nginx/ingress-nginx-leader"
I1015 04:33:50.884807       7 status.go:85] "New leader elected" identity="ingress-nginx-controller-596f8778bc-2hgdj"
I1015 04:33:50.887726       7 status.go:224] "POD is not ready" pod="ingress-nginx/ingress-nginx-controller-596f8778bc-2hgdj" node="minikube"
I1015 04:33:50.904908       7 controller.go:231] "Backend successfully reloaded"
I1015 04:33:50.904969       7 controller.go:243] "Initial sync, sleeping for 1 second"
I1015 04:33:50.905059       7 event.go:377] Event(v1.ObjectReference{Kind:"Pod", Namespace:"ingress-nginx", Name:"ingress-nginx-controller-596f8778bc-2hgdj", UID:"900f0117-9804-4d18-b599-a0ed1db84826", APIVersion:"v1", ResourceVersion:"25639", FieldPath:""}): type: 'Normal' reason: 'RELOAD' NGINX reload triggered due to a change in configuration
I1015 04:33:50.988557       7 status.go:224] "POD is not ready" pod="ingress-nginx/ingress-nginx-controller-596f8778bc-2hgdj" node="minikube"
E1015 04:34:11.556410       7 server.go:81] "Admission review request received" body=2244
W1015 04:34:11.557915       7 controller.go:1241] Service "external-https-poc/demo-web" does not have any active Endpoint.
W1015 04:34:11.557964       7 controller.go:1464] Error getting SSL certificate "external-https-poc/demo-tls": local SSL certificate external-https-poc/demo-tls was not found. Using default certificate
I1015 04:34:11.559042       7 main.go:107] "successfully validated configuration, accepting" ingress="external-https-poc/demo-web"
I1015 04:34:11.563598       7 store.go:443] "Found valid IngressClass" ingress="external-https-poc/demo-web" ingressclass="nginx"
I1015 04:34:11.564106       7 event.go:377] Event(v1.ObjectReference{Kind:"Ingress", Namespace:"external-https-poc", Name:"demo-web", UID:"3d3ef726-66c9-43b8-960d-30821c330e82", APIVersion:"networking.k8s.io/v1", ResourceVersion:"25752", FieldPath:""}): type: 'Normal' reason: 'Sync' Scheduled for sync
I1015 04:34:11.564512       7 backend_ssl.go:67] "Adding secret to local store" name="external-https-poc/demo-tls"
W1015 04:34:14.884360       7 controller.go:1241] Service "external-https-poc/demo-web" does not have any active Endpoint.
I1015 04:34:14.885281       7 controller.go:217] "Configuration changes detected, backend reload required"
I1015 04:34:14.915130       7 controller.go:231] "Backend successfully reloaded"
I1015 04:34:14.915525       7 event.go:377] Event(v1.ObjectReference{Kind:"Pod", Namespace:"ingress-nginx", Name:"ingress-nginx-controller-596f8778bc-2hgdj", UID:"900f0117-9804-4d18-b599-a0ed1db84826", APIVersion:"v1", ResourceVersion:"25639", FieldPath:""}): type: 'Normal' reason: 'RELOAD' NGINX reload triggered due to a change in configuration
I1015 04:34:50.894927       7 status.go:311] "updating Ingress status" namespace="external-https-poc" ingress="demo-web" currentValue=null newValue=[{"ip":"192.168.49.2"}]
I1015 04:34:50.897756       7 event.go:377] Event(v1.ObjectReference{Kind:"Ingress", Namespace:"external-https-poc", Name:"demo-web", UID:"3d3ef726-66c9-43b8-960d-30821c330e82", APIVersion:"networking.k8s.io/v1", ResourceVersion:"25807", FieldPath:""}): type: 'Normal' reason: 'Sync' Scheduled for sync
10.244.0.1 - - [15/Oct/2026:04:39:21 +0000] "GET / HTTP/2.0" 200 896 "-" "curl/8.7.1" 27 0.003 [external-https-poc-demo-web-80] [] 10.244.0.28:80 896 0.003 200 49a0d78075ba24cd66a8c404be4f32f4
apiVersion: v1
kind: Service
metadata:
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"v1","kind":"Service","metadata":{"annotations":{},"labels":{"app.kubernetes.io/component":"controller","app.kubernetes.io/instance":"ingress-nginx","app.kubernetes.io/name":"ingress-nginx"},"name":"ingress-nginx-controller","namespace":"ingress-nginx"},"spec":{"ipFamilies":["IPv4"],"ipFamilyPolicy":"SingleStack","ports":[{"appProtocol":"http","name":"http","port":80,"protocol":"TCP","targetPort":"http"},{"appProtocol":"https","name":"https","port":443,"protocol":"TCP","targetPort":"https"}],"selector":{"app.kubernetes.io/component":"controller","app.kubernetes.io/instance":"ingress-nginx","app.kubernetes.io/name":"ingress-nginx"},"type":"NodePort"}}
  creationTimestamp: "2026-10-15T04:33:31Z"
  labels:
    app.kubernetes.io/component: controller
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/name: ingress-nginx
  name: ingress-nginx-controller
  namespace: ingress-nginx
  resourceVersion: "25607"
  uid: 1cd82fe2-f781-43bc-ad35-c3517b7f2e37
spec:
  clusterIP: 10.110.12.192
  clusterIPs:
  - 10.110.12.192
  externalTrafficPolicy: Cluster
  internalTrafficPolicy: Cluster
  ipFamilies:
  - IPv4
  ipFamilyPolicy: SingleStack
  ports:
  - appProtocol: http
    name: http
    nodePort: 31496
    port: 80
    protocol: TCP
    targetPort: http
  - appProtocol: https
    name: https
    nodePort: 30520
    port: 443
    protocol: TCP
    targetPort: https
  selector:
    app.kubernetes.io/component: controller
    app.kubernetes.io/instance: ingress-nginx
    app.kubernetes.io/name: ingress-nginx
  sessionAffinity: None
  type: NodePort
status:
  loadBalancer: {}
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % curl --resolve demo.local:443:127.0.0.1 \
  --cacert certs/tls.crt \
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
keerthana@Keerthanas-MacBook-Air external-https-k8s-poc % 
