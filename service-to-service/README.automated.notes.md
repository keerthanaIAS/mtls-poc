
### Renewed certificates:
One important detail: your certificate duration is 1 hour and renewBefore is 20 minutes, so renewal should normally begin when the certificates have about 20 minutes of validity remaining—roughly 40 minutes after issuance, not necessarily after the full hour.

**cert-manager is watching the Certificate resources and renews them according to renewBefore: 20m**

* Why did our request fail?
Vault returned 403 invalid token. That means the signing request was rejected at the authentication/authorization stage; the token does not itself sign anything.
We subsequently confirmed that the token currently stored in Kubernetes is accepted by Vault. However, we still need to verify that cert-manager can successfully use it for a new signing request.
One important distinction: Vault's CA private key is what signs the certificate. The Vault token merely grants permission to request that signature.

* here why token with token only we can create certificate?
The token alone does not create a certificate. *The token gives cert-manager permission to ask Vault to sign a certificate*.

* To see the actual renewal and issuance events:
kubectl get events -n mtls-services \
  --sort-by='.lastTimestamp' | grep -E 'Renewing|successfully issued|CertificateRequest'

