### GitHub Actions Best Practices

#### Workflow Design
- Use descriptive workflow and job `name` fields for clear status checks in PRs
- Prefer `workflow_call` reusable workflows over duplicated job definitions across workflows
- Use path filters (`paths`, `paths-ignore`) to avoid unnecessary workflow runs
- Set `concurrency` groups on PR workflows with `cancel-in-progress: true`
- Define explicit `permissions` at workflow level; never rely on default broad token permissions

#### Action Usage
- Pin third-party actions to full SHA, not tags (`uses: actions/checkout@<sha>`)
- Prefer official `actions/*` marketplace actions for common tasks
- Create composite actions for repeated multi-step logic within the repository
- Document all action inputs/outputs with clear descriptions and defaults

#### Security
- Never echo secrets in logs; use `::add-mask::` for dynamic sensitive values
- Avoid `${{ github.event.*.body }}` in `run:` steps — pass through environment variables instead
- Use environment protection rules for production deployments
- Configure OIDC for cloud deployments instead of storing cloud credentials as secrets
- Regularly audit third-party action versions and review their source

#### Performance
- Cache dependencies aggressively — `node_modules`, Docker layers, build outputs
- Use `actions/cache` with content-hash keys (e.g., `hashFiles('**/pnpm-lock.yaml')`)
- Parallelize independent jobs; use `needs` only for true dependencies
- Use `timeout-minutes` on all jobs to prevent hung runners
- Prefer smaller, focused workflows over monolithic ones

#### Reliability
- Make workflows idempotent — safe to re-run without side effects
- Use `continue-on-error` sparingly and only with explicit status checks
- Add `retry` logic for flaky external calls (deployments, API calls)
- Test workflow changes in feature branches before merging to main
- Use `act` or similar tools for local workflow development and testing

#### Maintenance
- Keep actions and runner images up to date
- Document workflow purpose and trigger conditions with comments
- Use consistent naming conventions: `ci.yml`, `deploy.yml`, `release.yml`
- Store shared workflow configuration in `.github/` at the organization level when possible
