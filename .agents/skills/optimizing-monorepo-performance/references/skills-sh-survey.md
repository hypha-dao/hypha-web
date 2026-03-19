## Skills.sh survey used for this skill

### Turborepo / monorepo management

1. **Vercel Turborepo skill**
   - Directory entry: `vercel/turborepo` (turborepo skill)
   - Focus: monorepo management, caching, task configuration, CI/CD.
2. **Secondsky Turborepo skill**
   - Directory entry: `secondsky/claude-skills` (skill: `turborepo`)
   - Focus: package-level scripts + root `turbo run` wrappers, cache-aware task setup.

Install example:

```bash
npx skills add https://github.com/secondsky/claude-skills --skill turborepo
```

### GitHub Actions optimization

1. **GitHub Actions templates**
   - Directory entry: `wshobson/agents` (skill: `github-actions-templates`)
   - Focus: CI templates, matrix patterns, dependency caching, reusable workflow structure.
2. **Secure GitHub Action**
   - Directory entry: `secure-github-action`
   - Focus: SHA pinning, minimal permissions, safer workflow defaults.

Install example:

```bash
npx skills add https://github.com/wshobson/agents --skill github-actions-templates
```

### What was reused here

- Keep Turborepo orchestration in `turbo.json`, task commands in package scripts.
- Keep root `package.json` scripts as `turbo run <task>` wrappers.
- Prefer workflow-level skip logic (path filters/concurrency) before heavy CI work.
- Measure with baseline metrics before optimization and report before/after deltas.
