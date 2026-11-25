# Production DNS & TLS Report

**Gate status: BLOCKED BY OWNER INPUT** (production hostname and DNS authority unknown)
**Tooling status: DONE and verified** — `scripts/ops/check-dns-tls.mjs`
**Owner:** business owner (domain, DNS access) + release engineering (execution)

---

## 1. Why this is blocked, precisely

The check cannot run against production because **the intended production
hostname was never supplied**. `docker-compose.yml` defaults to
`http://localhost:3000`; Terraform takes `var.backend_url` and
`var.cloudfront_domain` as inputs with no committed value; no release document
names the production domain.

Running the TLS check against a guessed hostname would produce a report about
someone else's server. That is worse than an honest blocker, so it was not done.

## 2. What is verified today

### 2.1 — the checker itself works

Verified against a real TLS host (read-only, no changes):

```
$ node scripts/ops/check-dns-tls.mjs github.com
  PASS  dns-resolves            {"a":["4.187.247.160"],"aaaa":[],"cname":[]}
  PASS  tls-chain               {"protocol":"TLSv1.3","issuer":"Sectigo …"}
  PASS  tls-hostname-match      {"subject":"github.com","san":"DNS:github.com, DNS:www.github.com"}
  PASS  tls-expiry              {"validTo":"2027-01-27…","daysLeft":63}
  PASS  http-to-https-redirect  {"status":301,"location":"https://github.com/"}
  PASS  https-reachable         {"status":200}
  PASS  security-headers        {"missing":[]}
```

So the checks are not aspirational — the tool resolves DNS, validates the chain,
matches the hostname, computes expiry, follows the redirect and asserts headers.

### 2.2 — the application already sends the security headers

Measured on the running staging stack:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

HSTS is present even on the plain-HTTP local stack, so the policy is emitted by
the app rather than relying on the proxy alone. In production, TLS must terminate
in front of it and redirect 80 → 443.

### 2.3 — repository-level checks that already pass

| Check | Result |
| --- | --- |
| No `.env` in the Docker build context | PASS (`verify-build-context.mjs`) |
| No credential baked into either image | PASS (layer scans) |
| Production secrets injected at runtime only | PASS (compose `environment:`, Terraform `secrets` ARNs) |
| TLS certificate source defined in Terraform | present — CloudFront uses `var.acm_certificate_arn`, the same certificate as the ALB |

## 3. Checks that must run once the hostname exists

```bash
node scripts/ops/check-dns-tls.mjs <production-host>
```

| Check | Passing means |
| --- | --- |
| `dns-resolves` | the name points at the intended deployment |
| `tls-chain` | the chain validates; no self-signed or incomplete chain |
| `tls-hostname-match` | the certificate covers the exact hostname (SAN, not CN alone) |
| `tls-expiry` | > 30 days left; renewal mechanism proven |
| `http-to-https-redirect` | 301/308 to `https://` — not a 200 on port 80 |
| `https-reachable` | the app answers |
| `security-headers` | HSTS, nosniff, frame-options, referrer-policy present |

Also required, not covered by the script:

* renewal automation (ACME or ACM) *with* a monitored expiry alarm;
* that `www` and the apex behave consistently (one 301s to the other);
* that the API hostname and the storefront hostname are both covered;
* that internal names (postgres, redis) are **not** resolvable publicly.

## 4. Owner input required

| Item | Why | Owner |
| --- | --- | --- |
| Production domain name(s) | nothing can be checked without it | business owner |
| DNS provider access (or a delegated runner) | record changes must be authorized | business owner |
| Confirmation of who holds the ACM/ACME account | renewal ownership | business owner |
| Authorization to make DNS/TLS changes | changes are irreversible within TTL and affect live traffic | business owner |

## 5. Explicit commitments not made

* No DNS record was created or modified.
* No certificate was issued.
* No claim is made that any production hostname is reachable, valid or
  renewing — that would require §3 to run against the real name.

## 6. Status

| Item | Status |
| --- | --- |
| Checker implemented and proven | **DONE** |
| App security headers present | **DONE** |
| Certificate wiring defined in IaC | **DONE** |
| Production hostname known | **BLOCKED BY OWNER INPUT** |
| Production DNS/TLS verified | **BLOCKED BY OWNER INPUT** |
| Renewal automation verified | **BLOCKED BY OWNER INPUT** |

The DNS/TLS gate stays **BLOCKED**, not PASS.
