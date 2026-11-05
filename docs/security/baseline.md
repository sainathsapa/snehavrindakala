# Security baseline (draft)

## Application security (Section 15.5)
- MFA for privileged users; protect admin accounts.
- Least-privilege IAM roles for ECS tasks, build jobs, staff.
- PostgreSQL and Redis in private subnets; database ports not exposed publicly.
- HTTPS, WAF/rate limiting, secure headers, input validation.
- Secrets in AWS Secrets Manager / Parameter Store; never in browser code, source control, logs, or CMS content.
- Verify webhook signatures using raw request bodies.
- Protect file upload endpoints: type/size limits, generated object keys, malware scanning, private access, retention.
- Encrypt data at rest and in transit; define key rotation and backup controls.
- Patch dependencies and base images; scan containers and dependencies.
- Record security-sensitive admin operations in an audit log.
- Periodic access review and restore tests.

## Privacy (Section 15.3, DPDP Act)
- Collect only information needed for the requested transaction/service.
- Standalone, clear privacy notices explaining purpose and data categories.
- Separate transactional communications from optional marketing consent.
- Maintain consent records and an easy opt-out/withdrawal path.
- Define access, correction, deletion, grievance, and retention workflows.
- Limit access to customer reference images, addresses, phone numbers, artist payout records.
