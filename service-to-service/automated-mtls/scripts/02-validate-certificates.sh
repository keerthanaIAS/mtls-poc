#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"

for file in "$CLIENT_CERT" "$CLIENT_KEY" "$CA_CERT"; do
  if [[ ! -r "$file" ]]; then
    record_result "certificate-validation" "FAIL" "Missing or unreadable file: $file"
    exit 1
  fi
done

if ! openssl x509 -in "$CLIENT_CERT" -noout >/dev/null 2>&1; then
  record_result "certificate-validation" "FAIL" "Client certificate cannot be parsed"
  exit 1
fi

if ! openssl x509 -in "$CLIENT_CERT" -checkend 0 -noout; then
  record_result "certificate-validity" "FAIL" "Client certificate is expired or expiring now"
  exit 1
fi

if ! openssl pkey -in "$CLIENT_KEY" -noout >/dev/null 2>&1; then
  record_result "private-key-validation" "FAIL" "Private key cannot be parsed"
  exit 1
fi

cert_pub="$(openssl x509 -in "$CLIENT_CERT" -pubkey -noout 2>/dev/null |
  openssl pkey -pubin -outform DER 2>/dev/null | openssl dgst -sha256)"
key_pub="$(openssl pkey -in "$CLIENT_KEY" -pubout -outform DER 2>/dev/null |
  openssl dgst -sha256)"

if [[ -z "$cert_pub" || "$cert_pub" != "$key_pub" ]]; then
  record_result "certificate-key-match" "FAIL" "Certificate public key does not match private key"
  exit 1
fi

if ! openssl verify -CAfile "$CA_CERT" "$CLIENT_CERT"; then
  record_result "certificate-chain-validation" "FAIL" "Certificate verification against configured CA failed"
  exit 1
fi

echo "Client certificate subject:"
openssl x509 -in "$CLIENT_CERT" -noout -subject

echo "Client certificate validity:"
openssl x509 -in "$CLIENT_CERT" -noout -dates

echo "Client certificate extended key usage, if present:"
openssl x509 -in "$CLIENT_CERT" -noout -ext extendedKeyUsage 2>/dev/null || true

record_result "certificate-validation" "PASS" "Certificate parses, is currently valid, key matches and CA verification succeeds"
