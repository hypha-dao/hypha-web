### Application Security Best Practices

#### Do

- ✅ Validate all input server-side — use schema validation (Zod, Valibot) before any processing; never trust client-side validation alone
- ✅ Encode all output contextually — HTML-encode for HTML contexts, URL-encode for URLs, JavaScript-encode for script contexts, and use parameterised queries for SQL
- ✅ Implement Content Security Policy (CSP) with nonces or hashes — avoid `unsafe-inline` and `unsafe-eval` in production
- ✅ Set security headers on every response: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- ✅ Configure CORS restrictively — allowlist only known origins, avoid wildcard `*` with credentialed requests
- ✅ Use `SameSite=Lax` or `Strict` on all cookies; set `Secure`, `HttpOnly`, and `Path` attributes appropriately
- ✅ Authenticate every Server Action and API route — verify session/token before processing any mutation
- ✅ Authorise at the data layer — check that the requesting user has permission on the specific resource, not just a valid session
- ✅ Audit and pin dependencies — use lockfiles, run `npm audit` / `pnpm audit` regularly, enable automated dependency scanning (Dependabot, Renovate, Socket)
- ✅ Store secrets in environment variables or secret managers — never in source code, client bundles, or version control
- ✅ Rate-limit authentication endpoints and sensitive mutations to mitigate brute-force and credential-stuffing attacks
- ✅ Log security-relevant events (auth failures, permission denials, input validation rejections) with enough context for investigation but without leaking PII or secrets

#### Avoid

- ❌ Using `dangerouslySetInnerHTML` with unsanitised user input — if rich HTML is required, sanitise with a strict allowlist (DOMPurify)
- ❌ Exposing internal IDs, stack traces, or server paths in error responses — return generic messages to clients, log detail server-side
- ❌ Disabling CSRF protections — Next.js Server Actions include built-in Origin checking; do not bypass it
- ❌ Fetching user-supplied URLs on the server without SSRF protections — validate schemes (https only), block private/internal IP ranges, and use allowlists where possible
- ❌ Storing tokens or secrets in `localStorage` — prefer `HttpOnly` cookies for session tokens
- ❌ Granting overly broad OAuth scopes or API key permissions — apply least-privilege to every integration
- ❌ Committing `.env` files, private keys, or credentials to version control — use `.gitignore` and pre-commit hooks to prevent accidental exposure
- ❌ Trusting JWTs without verifying signature, expiry, audience, and issuer claims
- ❌ Using outdated or unmaintained dependencies — treat unpatched transitive dependencies as exploitable vulnerabilities
