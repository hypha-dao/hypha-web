# Project Workflow Patterns

Workflow patterns tailored for **hypha-dao/hypha-web** — a pnpm monorepo deployed to Vercel with Neon PostgreSQL.

## Table of Contents

1. [Feature Development](#feature-development)
2. [Bug Fix](#bug-fix)
3. [PR Review Cycle](#pr-review-cycle)
4. [CI Monitoring](#ci-monitoring)
5. [Release Management](#release-management)
6. [Issue Triage](#issue-triage)
7. [Database Migration PRs](#database-migration-prs)
8. [Monorepo-Specific Patterns](#monorepo-specific-patterns)

---

## Feature Development

```bash
# 1. Create feature branch
git checkout -b feat/user-dashboard main

# 2. Develop, commit, push
git push -u origin feat/user-dashboard

# 3. Create draft PR
gh pr create \
  --title "feat: add user dashboard" \
  --body "## Summary
- New dashboard component in apps/web
- Metrics API integration in packages/core

## Changes
- \`apps/web/\` — Dashboard page and components
- \`packages/core/\` — Metrics data layer

## Testing
- [ ] Unit tests
- [ ] E2E tests
- [ ] Preview deployment verified" \
  --draft \
  --label "enhancement"

# 4. Monitor preview deployment (deploy-preview.yml)
gh pr checks --watch

# 5. Verify preview URL from Vercel bot comment
gh pr view --json comments --jq '.comments[-1].body'

# 6. Mark ready when done
gh pr ready

# 7. Merge after approval
gh pr merge --squash --delete-branch
```

## Bug Fix

```bash
# 1. Create fix branch referencing issue
gh issue develop 42 --checkout

# Or manually:
git checkout -b fix/login-redirect main

# 2. Create PR linking issue
gh pr create \
  --title "fix: resolve login redirect loop (#42)" \
  --body "Closes #42

## Root Cause
[Description]

## Fix
[What was changed]

## Testing
- [ ] Reproduction steps no longer fail
- [ ] No regression in auth flow"

# 3. Merge
gh pr merge --squash --delete-branch
```

## PR Review Cycle

```bash
# List PRs needing review
gh pr list --search "review-requested:@me"

# Review workflow
gh pr checkout 55
gh pr diff 55

# Leave review
gh pr review 55 --approve --body "LGTM — tested locally"

# Or request changes
gh pr review 55 --request-changes --body "## Changes Needed
- [ ] Add error handling in \`packages/core/src/metrics/server/actions.ts\`
- [ ] Missing type for dashboard props"

# Check if author addressed feedback
gh pr diff 55
gh pr view 55 --json reviews --jq '.reviews[-1]'
```

## CI Monitoring

This project has three CI workflows:

| Workflow                | Trigger           | Purpose                                           |
| ----------------------- | ----------------- | ------------------------------------------------- |
| `deploy-preview.yml`    | PR opened/updated | Preview deploy + format check + DB migration test |
| `deploy-production.yml` | Push to main      | Production deploy + migrations                    |
| `cleanup-preview.yml`   | PR closed         | Clean up Neon preview DB branch                   |

```bash
# Check current PR's CI
gh pr checks

# List recent runs
gh run list --limit 10

# View failed preview deployment
gh run list --workflow deploy-preview.yml --branch feat/my-feature
gh run view <run-id> --log-failed

# Re-run failed deployment
gh run rerun <run-id> --failed

# Check production deployment
gh run list --workflow deploy-production.yml --branch main --limit 5

# Watch a deployment in progress
gh run watch <run-id>
```

### Common CI Failures

**Format check fails:**

```bash
# The preview workflow runs pnpm run format:check
# Fix locally:
pnpm run format:write
git add -A && git commit -m "style: format code"
git push
```

**Migration test fails:**

```bash
# Preview workflow creates a temporary Neon branch and runs migrations
# Check the migration logs:
gh run view <run-id> --log-failed
```

## Release Management

```bash
# View current releases
gh release list

# Create release with auto-generated notes
gh release create v3.0.0 \
  --title "v3.0.0" \
  --generate-notes \
  --target main

# Create prerelease for alpha
gh release create v3.0.0-alpha.1 \
  --title "v3.0.0-alpha.1" \
  --prerelease \
  --generate-notes

# Draft release for review before publishing
gh release create v3.0.0 \
  --draft \
  --generate-notes

# Edit existing release
gh release edit v3.0.0 --notes-file RELEASE_NOTES.md
```

## Issue Triage

```bash
# List open bugs
gh issue list --label "bug" --state open

# List unassigned issues
gh issue list --state open --search "no:assignee"

# Prioritize
gh issue edit 15 --add-label "priority:high" --add-assignee @me

# Batch label
for num in 10 11 12; do
  gh issue edit $num --add-label "sprint:current"
done

# Create linked issue from PR feedback
gh issue create \
  --title "Tech debt: refactor auth middleware" \
  --body "Identified during #55 review. The auth middleware in \`apps/web/src/middleware.ts\` needs refactoring." \
  --label "tech-debt"
```

## Database Migration PRs

The project uses Neon PostgreSQL with automated preview branches. Migration PRs trigger special CI behavior:

```bash
# Create migration PR
gh pr create \
  --title "db: add user_metrics table" \
  --body "## Migration
Adds \`user_metrics\` table to \`packages/storage-postgres/migrations/\`

## Schema Changes
- New table: \`user_metrics\`
- New index: \`idx_user_metrics_user_id\`

## Rollback
\`\`\`sql
DROP TABLE IF EXISTS user_metrics;
\`\`\`"

# The deploy-preview workflow will:
# 1. Create a Neon branch from main DB
# 2. Run migrations on the branch
# 3. Post a schema diff comment on the PR

# Check the schema diff comment
gh pr view --json comments --jq '.comments[] | select(.body | contains("Schema Diff"))'
```

## Monorepo-Specific Patterns

### PR Scoping

```bash
# List PRs that touch a specific package
gh pr list --search "packages/ui in:path"

# View which packages a PR changes
gh pr diff 42 --name-only | sort -u | cut -d/ -f1-2

# Create PR scoped to a workspace
gh pr create \
  --title "feat(ui): add metrics chart component" \
  --body "Scoped to \`packages/ui\`"
```

### Cross-Package Impact

```bash
# Check what depends on a changed package
# Then note affected packages in PR body
gh pr create \
  --title "refactor(core): update metrics types" \
  --body "## Affected Packages
- \`packages/core\` — Source of changes
- \`apps/web\` — Consumes metrics types
- \`packages/storage-postgres\` — Storage layer types updated"
```
