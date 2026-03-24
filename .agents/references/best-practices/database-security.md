### Database Security Best Practices

#### Do

- ✅ Apply least-privilege: grant only the permissions a role actually needs (`GRANT SELECT`, `GRANT INSERT`, not `SUPERUSER`)
- ✅ Use separate database roles per service/component — never share a single superuser connection string
- ✅ Store connection strings in secrets managers (Doppler, Vault, environment secrets) — never in source code or `.env` files committed to version control
- ✅ Enable SSL/TLS for all connections; verify server certificates in production (`sslmode=verify-full`)
- ✅ Rotate database passwords and API keys on a schedule and immediately after any suspected exposure
- ✅ Audit sensitive data access with row-level security (RLS) policies and `pg_audit` or equivalent logging
- ✅ Use parameterized queries and prepared statements at all times — never interpolate user input into SQL
- ✅ Restrict network access: use private networking, IP allowlists, or VPC peering where available
- ✅ Audit `pg_hba.conf` and connection sources regularly; remove stale entries
- ✅ Classify data by sensitivity and apply column-level encryption or masking for PII/sensitive fields

#### Avoid

- ❌ Connecting to production databases with superuser credentials from application code
- ❌ Logging full query text in environments where queries may contain PII or secrets
- ❌ Using `TRUST` authentication in `pg_hba.conf` outside of isolated local dev
- ❌ Granting `PUBLIC` schema permissions beyond what Postgres ships with by default
- ❌ Disabling SSL in any environment reachable from outside localhost
- ❌ Storing unencrypted PII or credentials in plaintext columns
- ❌ Using the same credentials across dev, staging, and production environments
