# Automated mTLS — Learning and Implementation Plan

## Goal

Automate security testing for communication between two backend services:

root-ms  --->  transaction-ms

The root-ms service acts as the mTLS client.
The transaction-ms service acts as the mTLS server.

The goal is to run one script that checks certificates, verifies secure
service-to-service communication, tests security failures, performs load
testing, monitors resources, and generates a report.

We will understand each step before implementing and running it.

---

## Step 1: Understand the Existing Environment

Identify:
- root-ms and transaction-ms
- Docker and Podman containers
- Container networks and service DNS
- Certificate and private-key locations
- Trusted Certificate Authority (CA)
- Existing HTTP endpoints

Expected result:
We know which services and certificates the automation will test.

## Step 2: Automate Certificate Validation

Check:
- Certificate files exist
- Certificate and private key match
- Certificate chains verify against the trusted CA
- Certificates are within their validity dates
- Server certificate has the appropriate server-auth usage
- Client certificate has the appropriate client-auth usage

Expected result:
The script reports PASS or FAIL for each certificate check.

Important:
Certificate validation checks are not a replacement for the actual TLS
handshake. The services must also enforce certificate verification.

## Step 3: Automate Successful mTLS Communication

Send a request through root-ms to transaction-ms.

Verify:
- HTTP 200 response
- Expected response from transaction-ms
- Authenticated client identity is root-ms
- Negotiated TLS version is TLS 1.2 or TLS 1.3

Expected result:
Both services establish an authenticated, encrypted connection.

## Step 4: Automate Negative Security Tests

Test that invalid connections are rejected:

1. Client provides no certificate.
2. Client provides a certificate signed by an untrusted CA.
3. Client certificate is expired.
4. Client certificate does not match its private key.
5. Client does not trust the server certificate's CA.
6. Server certificate hostname does not match the expected hostname.

Expected result:
Each invalid case is rejected for the expected security reason.

A test passes only when the expected rejection is verified.
An unexpected success or an inconclusive result must be reported separately.

## Step 5: Automate Server-to-Server Functional Tests

Verify:
- root-ms can reach transaction-ms using service DNS
- transaction-ms returns the expected response
- Invalid routes return the expected status
- Connection failures and timeouts are handled correctly

Expected result:
Normal communication works, and errors are handled safely.

## Step 6: Automate Load Testing

Run matched tests for Docker and Podman at concurrency levels:
- 100 concurrent requests
- 200 concurrent requests
- 500 concurrent requests

For each test, record:
- Total requests
- Successful requests
- Failed requests
- Requests per second
- Average latency
- P50, P95 and P99 latency
- Maximum latency
- Timeouts

Expected result:
A consistent performance dataset for both container engines.

## Step 7: Automate Resource Monitoring

During each load test, capture:
- Root service CPU usage
- Transaction service CPU usage
- Root service memory usage
- Transaction service memory usage

Expected result:
We can compare resource consumption alongside throughput and latency.

## Step 8: Automate the Final Report

Combine all test results into one report.

Include:
- Certificate validation results
- Positive mTLS test results
- Negative security test results
- Functional test results
- Docker-versus-Podman load comparison
- CPU and memory comparison
- Overall PASS, FAIL or INCONCLUSIVE status

Expected result:
One command runs the evaluation and saves the results without manually
executing every individual test.

---

## Planned Final Structure

automated-mtls/
  README.md                 # This learning guide
  run-all-tests.sh          # Main orchestrator (to be implemented)
  scripts/
    validate-certs.sh       # Certificate checks
    test-mtls.sh            # Positive and negative security tests
    test-service-call.sh    # Server-to-server functional tests
    run-load-tests.sh       # Load testing
    monitor-resources.sh    # CPU and memory monitoring
    generate-report.sh      # Combined report
  results/                  # Generated reports and CSV files

We will create each script only after understanding its purpose.

## Current Status

Planning only.
No new tests have been run.
The existing Docker and Podman POC remains unchanged.
