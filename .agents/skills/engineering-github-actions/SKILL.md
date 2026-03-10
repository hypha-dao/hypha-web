---
name: engineering-github-actions
description: Designs, reviews, and optimizes GitHub Actions workflows at senior level. Use when creating or modifying .github/workflows, reusable workflows, CI/CD pipelines, permissions, or caching. Always checks https://github.com/features/actions before answering.
---

# Senior GitHub Actions Engineer

Use this skill for architecture, implementation, review, and optimization of GitHub Actions workflows.

## Non-negotiable rule: docs-first

Before answering any GitHub Actions question, always:

1. Check `https://github.com/features/actions`.
2. Capture a short "docs check" note (date, what was validated).
3. Then check specific implementation docs from `docs.github.com/actions` as needed.

If `https://github.com/features/actions` is unavailable, state that explicitly and stop short of definitive recommendations.

Use `references/docs-first-protocol.md`.

## Senior engineering standards

- Prioritize correctness, security, and maintainability over cleverness.
- Minimize default permissions; grant least privilege.
- Prefer deterministic builds (`--frozen-lockfile`, pinned runtimes).
- Reduce wasted CI minutes via concurrency and targeted triggers.
- Avoid duplication with reusable workflows (`workflow_call`).

## Workflow for every task

1. **Docs check**
   - Validate features page first.
2. **Context gathering**
   - Read relevant workflow files and composite actions.
   - Identify triggers, critical paths, and required checks.
3. **Design**
   - Propose safest change set.
   - Keep behavioral compatibility unless user requests otherwise.
4. **Implementation**
   - Apply minimal edits to workflows/actions.
   - Keep YAML readable and explicit.
5. **Validation**
   - Lint/validate workflow syntax where available.
   - Confirm branch protection required checks are still satisfied.
6. **Report**
   - Include docs-check note first, then findings/changes/risks.

## Performance optimization defaults

- Add workflow/job `concurrency` with `cancel-in-progress: true` for PR workflows.
- Use path filters and conditional jobs to skip unaffected work.
- Use dependency caching (`setup-node` cache and/or `actions/cache`) with stable keys.
- Avoid redundant checkout/install/build steps across jobs.
- Use matrices only when signal value exceeds runtime cost.

Use `references/senior-actions-patterns.md`.

## Required response structure

1. Docs check note (`https://github.com/features/actions`)
2. Problem analysis
3. Proposed or applied changes
4. Risk and rollback notes
5. Performance/security follow-ups

## References

- `references/docs-first-protocol.md`
- `references/senior-actions-patterns.md`
