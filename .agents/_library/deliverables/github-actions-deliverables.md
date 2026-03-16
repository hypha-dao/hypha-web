### GitHub Actions Deliverables

| Artifact                    | Description                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Workflow Files**          | `.github/workflows/*.yml` — one workflow per concern (preview deploy, production deploy, cleanup, CI checks)      |
| **Composite Actions**       | `.github/actions/<name>/action.yml` — reusable step bundles with typed inputs/outputs                             |
| **Change Detection Config** | Path filters that gate expensive jobs to affected packages (migrations, contracts, app code)                      |
| **Environment Setup**       | GitHub Environments with protection rules, scoped secrets, and required reviewers for production                  |
| **Secret Documentation**    | Inventory of all `secrets.*` and `vars.*` referenced in workflows, their purpose, and rotation schedule           |
| **Caching Strategy**        | Configured caches for pnpm store, Turborepo outputs, and build artifacts with documented invalidation triggers    |
| **Dependabot Config**       | `.github/dependabot.yml` with grouped updates, ignore rules, and schedule tuned to team capacity                  |
| **Workflow Documentation**  | PR description or inline YAML comments explaining non-obvious trigger conditions, job dependencies, and env setup |
| **Migration Guide**         | Step-by-step instructions when changing workflow structure, renaming secrets, or adding new environments           |
| **Incident Playbook**       | Runbook for common CI failures: cache misses, Neon branch limits, Vercel token expiry, flaky tests               |
