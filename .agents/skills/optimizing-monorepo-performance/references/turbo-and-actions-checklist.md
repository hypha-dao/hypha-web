## Turborepo + GitHub Actions optimization checklist

Copy this checklist into task notes and check items off while working.

### 1) Baseline

- [ ] Collect last 10-20 runs for impacted workflows:
  - `gh run list --workflow deploy-preview --limit 20`
  - `gh run list --workflow deploy-production --limit 20`
- [ ] Record median duration and failure rate.
- [ ] Review one slow run log for repeated install/build work and cache misses.

### 2) Turborepo task graph

- [ ] Root `package.json` scripts only delegate with `turbo run <task>`.
- [ ] Package-level `package.json` files define actual task commands.
- [ ] `turbo.json` tasks have accurate `dependsOn`.
- [ ] `turbo.json` tasks define precise `outputs` for cacheability.
- [ ] `globalDependencies` is minimal.
- [ ] `env` lists are explicit; avoid wildcard env expansion.
- [ ] `cache: false` only where deterministic caching is unsafe.

### 3) GitHub Actions runtime

- [ ] Add PR concurrency cancellation.
- [ ] Add path filters for expensive jobs.
- [ ] Use `pnpm install --frozen-lockfile`.
- [ ] Keep `actions/checkout` fetch-depth minimal unless required.
- [ ] Remove duplicated dependency installs across jobs.
- [ ] Use remote Turbo cache env vars when available.

### 4) Repo-specific checks

- [ ] Extend `.github/actions/detect-changes/action.yml` beyond migrations when needed.
- [ ] Gate migration steps behind migration-path changes.
- [ ] Gate Vercel build/deploy behind frontend-affecting changes.

### 5) Validation and reporting

- [ ] Re-run affected workflows.
- [ ] Compare before/after medians and P95.
- [ ] Confirm no skipped-required-job regressions.
- [ ] Summarize improvements and next actions.

## Reusable snippets

### Concurrency guard for PR workflows

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Setup node + pnpm cache

```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm
- run: pnpm install --frozen-lockfile
```
