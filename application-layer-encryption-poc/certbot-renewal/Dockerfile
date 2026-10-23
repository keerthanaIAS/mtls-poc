FROM certbot/certbot:latest

RUN apk add --no-cache curl ca-certificates openssl

ARG TARGETARCH
RUN curl -fsSL \
  "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/${TARGETARCH}/kubectl" \
  -o /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl
