### GitHub Actions Engineering

#### Core Expertise

- **Workflow authoring:** YAML syntax, event triggers (`push`, `pull_request`, `workflow_dispatch`, `schedule`, `workflow_call`), conditional execution (`if`, `needs`, `outputs`)
- **Job orchestration:** Dependency graphs via `needs`, matrix strategies, concurrency groups, parallel vs sequential execution
- **Composite actions:** Reusable action bundles in `.github/actions/` with typed inputs/outputs — prefer over duplicated steps
- **Reusable workflows:** `workflow_call` trigger for cross-repo and intra-repo DRY patterns with input/secret passthrough
- **Caching:** `actions/cache` and built-in `cache` parameter on `actions/setup-node` for `pnpm` store, Turborepo remote cache, and Docker layers
- **Artifact management:** `actions/upload-artifact` / `actions/download-artifact` for passing data between jobs
- **Secret management:** Repository and environment secrets, `GITHUB_TOKEN` scoping, OIDC federation for cloud providers
- **Environment protection:** Environment-scoped secrets, required reviewers, deployment gates, wait timers

#### Monorepo CI Patterns

- **Change detection:** `dorny/paths-filter` or `tj-changed-files` to scope jobs to affected packages — avoid rebuilding the world on every PR
- **Turborepo integration:** `turbo build --filter=...[HEAD~1]` for affected-package builds; `nx-set-shas` for base/head SHA resolution
- **pnpm workspace caching:** Cache `pnpm store` via `actions/setup-node` with `cache: 'pnpm'` — avoids full reinstall on cache hit

#### Deployment Patterns

- **Preview deployments:** Per-PR environments with isolated infrastructure (Neon DB branches, Vercel preview URLs)
- **Production deployments:** `concurrency: production` to serialize deploys, environment protection rules, post-deploy verification
- **Cleanup workflows:** `pull_request: types: [closed]` to tear down preview infrastructure (delete Neon branches, Vercel deployments)
- **Rollback:** Vercel instant rollback via dashboard or `vercel rollback` CLI; DB rollback via Neon branch restore

#### Security Posture

- **Least-privilege permissions:** Per-job `permissions` blocks instead of `write-all` — scope to `contents: read`, `pull-requests: write`, etc.
- **Pin actions by SHA:** `uses: actions/checkout@<sha>` prevents supply-chain attacks from tag mutation
- **Secret rotation:** Document which secrets are used where; audit with `gh secret list`
- **Fork safety:** Understand that `pull_request` from forks cannot access secrets; use `pull_request_target` carefully with explicit checkout constraints
