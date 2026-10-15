# What is NGINX Ingress?
NGINX Ingress is the entry point that receives incoming HTTP/HTTPS requests and routes them to the correct application inside Kubernetes.

# 1. Internal vs external communication

### Internal — mTLS

root-ms -> Client service
mTLS — both verify certificates -> transaction-ms

Server service -> Both services authenticate each other. In your Kubernetes POC, the services communicate using Kubernetes Service DNS.

### External — TLS / HTTPS

Browser or external client -> HTTPS — server proves its identity -> Kubernetes Ingress / Gateway 

The client verifies the server's certificate. The client usually does not need a certificate of its own.

## 2. How do we configure external TLS in Kubernetes?

The usual approach is Ingress/Gateway + TLS certificate.

External user -> [https://api.example.com](https://api.example.com)

Ingress Controller -> Handles HTTPS and presents the TLS certificate

Kubernetes Service → Backend Pod -> Forwards the request to your application

Typical setup:

1. Obtain a server certificate from a trusted CA, such as Let's Encrypt.
2. Store the certificate and private key in a Kubernetes TLS Secret.
3. Configure an Ingress Controller to use that Secret for HTTPS.
4. External users connect through HTTPS.

You can use cert-manager to automate certificate issuance and renewal. Certbot is another ACME client, often used outside Kubernetes or in custom workflows.

## 1. What does “external SSL” mean?

Your senior assigned external SSL/HTTPS research to someone else. You're learning how it works, not necessarily implementing the same mTLS setup you already built.

External HTTPS means a client outside your application’s Kubernetes network securely connects to a server using HTTPS.

For our example:

External client -> Browser or curl running on your Mac

NGINX Ingress Controller (HTTPS / TLS) -> Receives HTTPS and checks the server certificate

Kubernetes Service: `demo-web` -> Routes the request to the application Pod

Nginx web server Pod -> Runs `nginx:alpine` and returns the welcome page

The important distinction: the Ingress controller is the HTTPS entry point; the Nginx Pod is the application server. They're different components.

### 2-way SSL means mTLS (Mutual TLS). You're right to distinguish it from one-way TLS.

| Type                | What happens?                                                                      |
| ------------------- | ---------------------------------------------------------------------------------- |
| One-way TLS (HTTPS) | Client verifies the server's certificate.                                          |
| Two-way SSL (mTLS)  | Client verifies the server, and the server also verifies the client's certificate. |

For the external 2-way SSL task, the expected flow is:

1. Client outside Kubernetes connects to the server.
2. Server presents its certificate.
3. Client verifies the server certificate.
4. Client presents its own certificate.
5. Server verifies the client certificate and allows the connection.

Our current `external-https-k8s-poc` setup uses a self-signed server certificate at NGINX Ingress. It is only one-way TLS so far; we have not configured or tested mTLS.

# What we built now vs. your previous POC

### Current POC — external-client-to-server mTLS

Client on your Mac
`curl` + client certificate
        |
HTTPS / mTLS

NGINX Ingress Controller
External entry point configured with server TLS and client-certificate verification
        |
Nginx application Pod
Returns the welcome page

Current address: `https://demo.local/` via `127.0.0.1` and `minikube tunnel`. This is local access, not public internet access.

### Previous POC — service-to-service mTLS

`root-ms`
Backend client with its certificate
        |
HTTPS / mTLS inside Kubernetes

`transaction-ms`
Backend server verifies `root-ms` certificate

## Where is the external configuration?

In the current POC, the external entry point is the NGINX Ingress Controller, configured by the `demo-web` Ingress resource and its annotations. The server certificate is in `demo-tls`; the trusted client CA is in `demo-client-ca`.

Run this to inspect the actual configuration:
```
kubectl describe ingress demo-web -n external-https-poc

kubectl get ingress demo-web -n external-https-poc -o yaml

kubectl get svc ingress-nginx-controller -n ingress-nginx
```

## What is still missing for a real external deployment?

- A real hostname, such as `api.example.com`.
- A reachable external IP or load balancer and DNS pointing to it.
- Network/firewall configuration permitting HTTPS traffic.
- A certificate appropriate for that real hostname, and a client certificate issued by a CA trusted by the server.

Conclusion: We have implemented and tested the external-client mTLS pattern locally, not deployed a publicly reachable external mTLS service.

# Is this external two-way SSL?
It is external-client-to-server mTLS relative to the Kubernetes application, but only in a local test environment.
- Your Mac acts as the external client.
- NGINX Ingress acts as the TLS/mTLS entry point.
- The Ingress verifies the client certificate.
- The application Pod receives the forwarded request.

## 1. What is NGINX Ingress?

NGINX Ingress is the entry point that receives incoming HTTP/HTTPS requests and routes them to the correct application inside Kubernetes.

In our POC, we have three components:

- NGINX Ingress Controller: receives HTTPS requests and handles TLS/mTLS.
- Kubernetes Service (`demo-web`): routes requests to the application Pod.
- Nginx application Pod: serves the welcome page.

The Ingress Controller is a separate NGINX instance from the Nginx web server running in your application Pod.

## 2. How does it verify the client certificate (CC)?

Your client certificate is `certs/mtls/client.crt`. The trusted CA certificate is stored in Kubernetes Secret `demo-client-ca`.

Your Mac — `curl`
Sends client certificate + proves possession of its private key
        |
NGINX Ingress Controller
1\. Requests a client certificate during TLS handshake
2\. Checks its certificate chain against the trusted CA
3\. Checks validity and whether the client proves it owns the private key
        |
Valid
Continue request

Invalid
Reject connection
        |
`demo-web` Service → application Pod
Reached only after successful client-certificate verification

### 3. Where did we configure this verification?

These are the exact annotations from your Ingress:

```
nginx.ingress.kubernetes.io/auth-tls-secret: external-https-poc/demo-client-ca
nginx.ingress.kubernetes.io/auth-tls-verify-client: "on"
nginx.ingress.kubernetes.io/auth-tls-verify-depth: "1"
```

| Configuration                  | Meaning                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `auth-tls-secret`              | Tells NGINX which CA certificate to trust for client certificates |
| `auth-tls-verify-client: "on"` | Makes a client certificate mandatory and enables verification     |
| `auth-tls-verify-depth: "1"`   | Limits certificate-chain verification depth                       |

### 4. How did our tests prove it works?

- Trusted client certificate: HTTP 200 — accepted.
- No client certificate: HTTP 400 — rejected because no required certificate was sent.
- Untrusted client certificate: HTTP 400 — rejected because its CA was not trusted.

One important detail: NGINX does not need to receive or inspect your client's private key. The client proves possession of that key during the TLS handshake; NGINX verifies the certificate and the proof.

In simple terms: the trusted CA tells NGINX which client certificates it can trust, and the Ingress configuration makes that check mandatory before forwarding the request to your application.