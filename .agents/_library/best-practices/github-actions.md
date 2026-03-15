### GitHub Actions Best Practices

#### Do

- Define `permissions` per-job with minimum required scopes — never rely on the default `write-all`
- Use `concurrency` groups to prevent parallel runs that conflict (e.g., `concurrency: preview-${{ github.event.number }}`)
- Cache aggressively: pnpm store, Turborepo outputs, Neon branch existence checks
- Pin third-party actions by full SHA, not tag — tags are mutable and a supply-chain risk
- Use composite actions (`.github/actions/`) to extract repeated step sequences
- Use `workflow_call` for reusable workflows shared across repos or triggered by other workflows
- Gate production deploys with GitHub Environments: required reviewers, branch protection, wait timers
- Keep secrets scoped to environments when possible (production secrets ≠ preview secrets)
- Add `timeout-minutes` to jobs — prevent hung runners from burning minutes
- Use `if: always()` only on cleanup steps (e.g., deleting Neon branches) — not on core logic
- Separate concerns: one workflow per purpose (preview deploy, production deploy, cleanup, lint/test)
- Use `dorny/paths-filter` or equivalent to skip expensive jobs when their code paths didn't change
- Fail fast in matrix builds: `fail-fast: true` (default) unless you need all results

#### Avoid

- Using `pull_request_target` with `actions/checkout` on the PR head — gives fork PRs write access to secrets
- Hardcoding version numbers for Node, pnpm, or actions — parameterize or use `.node-version` / `packageManager` field
- Storing secrets in workflow files, even in comments — use `${{ secrets.* }}` exclusively
- Running `npm install --global` for tools available as actions (e.g., use `pnpm/action-setup` instead of installing pnpm manually)
- Creating Neon branches unconditionally when only migration-affected PRs need them — gate with change detection
- Using `continue-on-error: true` to mask flaky steps — fix the root cause instead
- Duplicating step sequences across workflows — extract to composite actions
- Using `GITHUB_TOKEN` for operations that need elevated permissions — create a fine-grained PAT or GitHub App token
- Echo-ing secrets to logs, even indirectly (e.g., connection strings in error output)
- Ignoring `workflow_run` event for post-merge cleanup — rely on `pull_request: types: [closed]` or `delete` events instead
