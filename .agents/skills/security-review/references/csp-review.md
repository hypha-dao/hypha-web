# CSP Review Guide

## Evaluating an Existing CSP

### 1. Find the CSP

```bash
# In Next.js projects
grep -rn "Content-Security-Policy" --include="*.{ts,js,tsx,jsx,mjs}" .
grep -rn "contentSecurityPolicy\|csp" --include="*.{ts,js,tsx,jsx,mjs}" . | grep -vi node_modules
```

Check: `next.config.js`, middleware, `_document`, meta tags, server config.

### 2. Parse and Evaluate Directives

Key directives to check:

| Directive | Ideal | Red Flags |
|-----------|-------|-----------|
| `default-src` | `'self'` | `*`, missing entirely |
| `script-src` | `'self'` + nonces | `'unsafe-inline'`, `'unsafe-eval'`, `*` |
| `style-src` | `'self'` + nonces/hashes | `'unsafe-inline'` |
| `img-src` | `'self'` + specific domains | `*`, `data:` without reason |
| `connect-src` | `'self'` + API domains | `*` |
| `frame-ancestors` | `'none'` or `'self'` | `*`, missing |
| `object-src` | `'none'` | anything else |
| `base-uri` | `'self'` or `'none'` | `*`, missing |

### 3. Common CSP Weaknesses

- **`unsafe-inline` in script-src**: Defeats XSS protection entirely. Migrate to nonces.
- **`unsafe-eval`**: Allows `eval()`, `Function()`, `setTimeout(string)`. Remove or isolate.
- **Overly broad domains**: `*.googleapis.com` allows any Google service. Be specific.
- **`data:` in script-src**: Allows `<script src="data:...">` XSS payloads.
- **Missing `frame-ancestors`**: Clickjacking risk.
- **Report-only without enforcement**: `Content-Security-Policy-Report-Only` doesn't block.

### 4. Nonce Implementation (Next.js)

Proper nonce flow:
1. Generate per-request nonce in middleware
2. Pass nonce to CSP header: `script-src 'nonce-{value}'`
3. Next.js applies nonce to inline scripts automatically (App Router)
4. Verify nonce appears on rendered `<script>` tags

```bash
# Check if nonce is generated
grep -rn "nonce" --include="*.{ts,js,tsx,jsx,mjs}" src/ | grep -v node_modules
```

### 5. Testing CSP

- Open browser DevTools → Console → look for CSP violation errors
- Use `Content-Security-Policy-Report-Only` header for testing without breaking
- Check `report-uri` or `report-to` directive for violation reporting
- Test with: `curl -I https://your-site.com | grep -i content-security`
