# External 2-way SSL (mTLS) — production flow

In production, an external client (another company, partner system, or an authorized application) connects to your publicly reachable server. Both sides verify each other's certificates before exchanging application data.

## 1. Production architecture diagram

          EXTERNAL CLIENT / PARTNER SYSTEM
          --------------------------------
          Client application
          Client certificate + private key
                         |
                         |
                         | 1. HTTPS connection
                         |    over the internet
                         v
          PUBLIC DNS + LOAD BALANCER
          --------------------------------
          Example: api.company.com:443
          Routes traffic to Kubernetes
                         |
                         v
          NGINX INGRESS CONTROLLER
          --------------------------------
          Holds:
          - Server certificate + private key
          - Trusted client CA certificate

          2. Presents server certificate
                         |
                         v
          EXTERNAL CLIENT
          --------------------------------
          3. Verifies server certificate
          4. Presents client certificate
             and proves possession of its
             matching private key
                         |
                         v
          NGINX INGRESS CONTROLLER
          --------------------------------
          5. Verifies client certificate
             against trusted client CA

             +--------------------------+
             | Certificate valid?       |
             +--------------------------+
                   |             |
                 YES             NO
                   |             |
                   v             v
             Continue       Reject request
                   |
                   v
          KUBERNETES SERVICE
          --------------------------------
          Routes request to backend
                   |
                   v
          BACKEND APPLICATION POD
          --------------------------------
          Processes the request
          Returns the response
                   |
                   v
          RESPONSE RETURNS TO CLIENT
          Over the established connection

## 2. How the two-way SSL handshake happens

1. Client connects to the public hostname. For example, `https://api.company.com`. DNS resolves the hostname to the public endpoint.
2. Server proves its identity. The server presents its certificate. The client checks that it is trusted, valid, and matches `api.company.com`.
3. Server requests the client certificate. During the TLS handshake, NGINX Ingress asks the client to authenticate with a certificate.
4. Client proves its identity. The client presents its certificate and proves possession of the matching private key.
5. Server verifies the client. NGINX checks the certificate chain against the trusted client CA and performs the applicable certificate validation.
6. Secure communication begins. If both sides pass verification, the encrypted connection is established and the request can be routed to the backend.

## 3. Where do the certificates come from?

| Certificate or key            | Who holds it?    | Purpose                                    |
| ----------------------------- | ---------------- | ------------------------------------------ |
| Server certificate            | Server / Ingress | Proves the server's identity               |
| Server private key            | Server / Ingress | Proves possession of the server identity   |
| Client certificate            | External client  | Identifies the connecting client           |
| Client private key            | External client  | Proves possession of the client identity   |
| Trusted client CA certificate | Ingress          | Lets the server verify client certificates |

The server and client certificates can be issued by the same trusted CA or by different CAs, provided each verifier trusts the CA that issued the certificate it checks.

## 4. What is different from our local POC?

| Local POC                                  | Production                                                           |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `demo.local`                               | Real DNS name, such as `api.company.com`                             |
| `127.0.0.1` and `minikube tunnel`          | Publicly reachable endpoint and network routing                      |
| Self-signed CA created for learning        | Approved certificate authority and certificate lifecycle             |
| Sample Nginx welcome page                  | Actual application backend                                           |
| Client certificate verification at Ingress | Client certificate verification at the approved external entry point |

Our local POC already demonstrates the certificate-verification part. Production additionally requires the real network endpoint, DNS, firewall/load-balancer configuration, trusted certificate issuance, monitoring, and certificate renewal.

Important production detail: If a separate load balancer terminates TLS before NGINX Ingress, the architecture must explicitly ensure that client-certificate authentication happens at the intended trusted component. Otherwise, the external client’s mTLS identity may not be verified where expected.