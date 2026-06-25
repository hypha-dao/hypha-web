### GitHub Actions Tooling

#### Development & Authoring
- **VS Code Extensions:** GitHub Actions extension for syntax highlighting, validation, and autocompletion
- **actionlint:** Static analysis and linting for workflow YAML files — catches syntax errors, type mismatches, and deprecated features
- **act:** Local workflow runner for rapid iteration without pushing to GitHub

#### Debugging & Troubleshooting
- **Debug logging:** Enable with `ACTIONS_RUNNER_DEBUG` and `ACTIONS_STEP_DEBUG` secrets
- **GitHub CLI (`gh`):** `gh run list`, `gh run view`, `gh run rerun` for workflow management from terminal
- **Workflow run logs:** Structured log analysis via GitHub UI or API

#### Security & Compliance
- **Dependabot:** Automated version updates for actions in workflow files
- **StepSecurity Harden-Runner:** Network and process monitoring for GitHub Actions runners
- **Scorecard:** OpenSSF security health assessment for GitHub repositories including CI/CD practices
- **OSSF Allstar:** Policy enforcement for GitHub organizations

#### Monitoring & Analytics
- **GitHub API:** Workflow run metrics, billing data, and usage statistics via REST/GraphQL API
- **Actions Usage Metrics:** Organization-level runner and workflow usage dashboards
- **Custom dashboards:** Workflow duration, success rate, and cost tracking via API exports
