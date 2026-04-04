---
name: security-review
description: Review code for security vulnerabilities and hardening opportunities. Use when auditing code for XSS, injection, auth flaws, CSP issues, dependency risks, secrets exposure, or any security concern. Also trigger when the user says "security review", "security audit", "check for vulnerabilities", "is this secure", or mentions OWASP, CVE, or CSP.
---

# Security Review

Perform structured security reviews of code, configurations, and infrastructure to identify vulnerabilities, misconfigurations, and hardening opportunities.

## When to Use

- Reviewing code for security vulnerabilities (XSS, injection, CSRF, etc.)
- Auditing authentication/authorization flows
- Checking CSP, CORS, or other security headers
- Reviewing dependency security (supply chain)
- Checking for secrets/credentials in code
- Evaluating infrastructure or deployment configs

## Review Process

### 1. Scope the Review

Determine what to review based on the request:
- **Code change**: Focus on the diff (`git diff` or PR files)
- **Full audit**: Scan the entire codebase or specific directories
- **Targeted**: Focus on a specific vulnerability class

### 2. Run Automated Checks

Before manual review, run available tooling:

```bash
# Check for secrets in code
grep -rn "password\|secret\|api_key\|token\|private_key" --include="*.{ts,js,tsx,jsx,py,env,yaml,yml,json}" . | grep -v node_modules | grep -v ".git"

# Check for hardcoded URLs that might leak internal infra
grep -rn "localhost\|127\.0\.0\.1\|0\.0\.0\.0" --include="*.{ts,js,tsx,jsx}" src/

# Review package.json for known patterns
cat package.json | grep -E "scripts|dependencies" -A 50
```

If `pnpm audit` or `npm audit` is available, run it.

### 3. Manual Review — Checklist

Work through each category. Report findings with severity (Critical/High/Medium/Low/Info).

Read `references/checklist.md` for the full checklist.

### 4. Report Findings

For each finding, report:
- **Severity**: Critical / High / Medium / Low / Info
- **Category**: (e.g., XSS, Injection, Auth, Config)
- **Location**: File path and line number
- **Description**: What the issue is
- **Recommendation**: How to fix it
- **Evidence**: Code snippet or proof

### 5. Summary

End with:
1. Total findings by severity
2. Top 3 risks
3. Recommended immediate actions

## References

- `references/checklist.md` — Full vulnerability checklist by category
- `references/csp-review.md` — CSP-specific review guidance
- `references/common-fixes.md` — Common fix patterns for frequent vulnerabilities
