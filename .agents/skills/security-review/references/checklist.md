# Security Review Checklist

## Injection

- [ ] SQL/NoSQL injection in queries (parameterized queries used?)
- [ ] Command injection via `exec`, `spawn`, `system` calls
- [ ] Template injection (server-side template engines)
- [ ] Path traversal in file operations (`../` in user input)
- [ ] LDAP/XML/XPath injection where applicable

## Cross-Site Scripting (XSS)

- [ ] `dangerouslySetInnerHTML` usage — is input sanitized?
- [ ] User input rendered without escaping in templates
- [ ] URL parameters reflected in page content
- [ ] `innerHTML`, `outerHTML`, `document.write` usage
- [ ] SVG/image uploads that could contain scripts
- [ ] `javascript:` URLs in `href` or `src` attributes

## Authentication & Authorization

- [ ] Auth bypass via missing middleware on routes
- [ ] Broken access control (IDOR — can user A access user B's data?)
- [ ] JWT: algorithm confusion, missing expiry, weak secret
- [ ] Session fixation or missing session regeneration on login
- [ ] Password stored in plaintext or weak hash (use bcrypt/argon2)
- [ ] Missing rate limiting on login/signup endpoints
- [ ] OAuth: state parameter validated? redirect_uri validated?

## Cross-Site Request Forgery (CSRF)

- [ ] State-changing operations require CSRF tokens
- [ ] SameSite cookie attribute set appropriately
- [ ] Custom headers required for API mutations

## Security Headers & CSP

- [ ] Content-Security-Policy present and restrictive
- [ ] No `unsafe-inline` or `unsafe-eval` in CSP (use nonces/hashes)
- [ ] `Strict-Transport-Security` header present
- [ ] `X-Content-Type-Options: nosniff` set
- [ ] `X-Frame-Options` or CSP `frame-ancestors` set
- [ ] `Referrer-Policy` configured
- [ ] `Permissions-Policy` restricting browser features

## Secrets & Credentials

- [ ] No API keys, tokens, or passwords in source code
- [ ] `.env` files in `.gitignore`
- [ ] No secrets in client-side bundles (check `NEXT_PUBLIC_` prefix usage)
- [ ] Secrets rotated if previously committed (check git history)
- [ ] Service account keys scoped to minimum permissions

## Dependencies & Supply Chain

- [ ] `pnpm audit` / `npm audit` shows no critical vulnerabilities
- [ ] No pinned dependencies with known CVEs
- [ ] Lock file committed and up to date
- [ ] No unnecessary `postinstall` scripts in dependencies
- [ ] Subresource Integrity (SRI) for CDN scripts

## Data Exposure

- [ ] Sensitive data not logged (passwords, tokens, PII)
- [ ] API responses don't leak internal data (stack traces, DB schemas)
- [ ] Error messages generic to end users, detailed only in logs
- [ ] GraphQL introspection disabled in production
- [ ] Source maps not served in production

## Infrastructure & Deployment

- [ ] HTTPS enforced (no mixed content)
- [ ] CORS configured restrictively (not `*` in production)
- [ ] Environment variables validated at startup
- [ ] File upload size limits and type validation
- [ ] Rate limiting on public endpoints
- [ ] Database connections use TLS
