## Docs-first protocol (mandatory)

Use this protocol before any GitHub Actions recommendation or implementation.

### Step 1: Required source check

- Open/verify: `https://github.com/features/actions`
- Record:
  - Date checked
  - Short summary of validated platform claims (for example: hosted runners, workflow automation, CI/CD scope)

### Step 2: Implementation docs check

After step 1, verify the relevant `docs.github.com/actions` pages for the specific change:

- Workflow syntax
- Concurrency
- Caching
- Reusable workflows
- Permissions / security hardening

### Step 3: Response preamble

Start every response with:

```text
Docs check: Verified https://github.com/features/actions on <YYYY-MM-DD>.
```

Then continue with analysis and recommendations.

### Step 4: If docs are unavailable

If step 1 cannot be completed:

- Say the features page could not be verified.
- Provide only tentative guidance.
- Ask to retry when docs are reachable.
