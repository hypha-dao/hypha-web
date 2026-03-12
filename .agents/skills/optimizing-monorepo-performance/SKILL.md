---
name: optimizing-monorepo-performance
description: Maintains and performance-optimizes this Turborepo + pnpm monorepo and GitHub Actions pipelines. Use when editing turbo.json, package scripts, pnpm workspace config, or .github/workflows to reduce CI duration, cache misses, and unnecessary work.
---

# Monorepo Performance Optimization (Hypha)

Use this skill when modifying monorepo build orchestration, package task wiring, or GitHub Actions runtime behavior.

## Use this skill when

- A change touches `turbo.json`, root/package scripts, `pnpm-workspace.yaml`, or `.github/workflows/*.yml`.
- CI is slow, expensive, flaky, or repeating installs/builds.
- A PR needs safe performance optimizations without deployment behavior regressions.

## Skills.sh research distilled

- `vercel/turborepo` Turborepo skill: monorepo task graph, caching, CI/CD patterns.
- `secondsky/claude-skills:turborepo`: define tasks in package `package.json`; keep root scripts as `turbo run <task>` wrappers.
- `wshobson/agents:github-actions-templates`: matrix/caching/reusable workflow patterns for faster CI.
- `secure-github-action`: SHA pinning and permissions hardening (stability and security baseline).

See `references/skills-sh-survey.md` for details and install commands.

## Repository baseline

- Workspace packages: `apps/*`, `packages/*`, `config/*`.
- Turbo task graph is in `turbo.json`.
- Deployment workflows: `.github/workflows/deploy-preview.yml`, `deploy-production.yml`, `cleanup-preview.yml`.
- Change detection action currently filters migration paths only (`packages/storage-postgres/migrations/**`).

## Optimization workflow

1. **Measure first**
   - Capture recent durations with `gh run list --workflow <workflow-name> --limit 20`.
   - Inspect logs with `gh run view <run-id> --log` for cache misses and repeated work.
2. **Fix Turborepo graph/caching**
   - Keep root scripts thin (`turbo run <task>`).
   - Keep task commands in package `package.json`.
   - Set precise `inputs`, `outputs`, and `env` in `turbo.json`.
   - Avoid `env: ["*"]` unless required.
   - Use `cache: false` only for side-effectful tasks.
3. **Fix GitHub Actions runtime**
   - Add `concurrency` + `cancel-in-progress: true` for PR jobs.
   - Add/expand path filters to skip unaffected heavy jobs.
   - Use `pnpm install --frozen-lockfile`.
   - Keep `fetch-depth` minimal unless full history is required.
   - Avoid duplicate installs in multiple jobs.
   - Enable Turborepo remote caching (`TURBO_TOKEN`, `TURBO_TEAM`) when available.
4. **Repo-specific guardrails**
   - Ensure detect-changes filters include all expensive paths, not only migrations.
   - Run migrations only when migration files changed.
   - Skip Vercel build/deploy when frontend-affecting paths are unchanged.
5. **Validate impact**
   - Compare before/after median durations.
   - Confirm no deployment behavior regressions.

## Output format for optimization tasks

Return results in this order:
1. Baseline metrics
2. Changes made (files + rationale)
3. Before/after performance delta
4. Follow-up opportunities

## References

- `references/skills-sh-survey.md`
- `references/turbo-and-actions-checklist.md`
