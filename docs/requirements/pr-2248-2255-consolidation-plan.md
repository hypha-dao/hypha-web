# PR 2248 + 2255 Consolidation Plan (No-Regression)

## Objective

Produce one clean production PR against `origin/main` that includes required outcomes from both PRs while removing iterative churn and preserving known-good behavior:

- AI behavior and quality bar should match the current accepted state from PR `2248`.
- Neon/Postgres changes should reflect only the final, stable schema/runtime state (no dead migrations, no duplicate index churn).
- Mention notifications, signal-team controls, and coherence UI improvements from PR `2255` should be included only when they pass type, behavior, and UX checks.

No feature implementation is performed in this plan PR. This document defines the execution path.

## Current Reality Snapshot

- PR `2248`: very large, high iteration count, mostly green checks.
- PR `2255`: overlapping scope with `2248`; currently has a failing `check-types`.
- Direct overlap files identified:
  - `apps/web-e2e/src/panels-space-context.spec.ts`
  - `apps/web/src/app/[lang]/onboarding/_components/onboarding-adventure-page.tsx`
  - `packages/core/src/matrix/client/hooks/use-matrix-token.ts`
  - `packages/core/src/matrix/client/providers/matrix-provider.tsx`
  - `packages/core/src/server.ts`
  - `packages/epics/src/coherence/components/signal-card.tsx`

## Consolidation Strategy

Use a **single integration branch from `origin/main`**, then re-assemble desired outcomes by domain instead of merging both PR branches as-is.

### Why this approach

- Avoids importing historical fix/revert churn.
- Makes every included change intentional and reviewable.
- Prevents silent regressions from conflict auto-resolution.
- Produces one auditable release narrative for go-live.

## Execution Plan

### Phase 1: Freeze and Baseline

1. Freeze further commits to PR `2248` and `2255` during consolidation.
2. Record exact SHAs used as source snapshots.
3. Capture baseline checks on `origin/main`:
   - `check-types`
   - format/lint gates
   - critical e2e path smoke
4. Capture current production behavior notes for:
   - AI chat stream behavior
   - signal card rendering
   - mention notification flow
   - matrix token/session stability

Exit gate: deterministic baseline report is stored in PR description/checklist.

### Phase 2: Build Clean Integration Branch

1. Branch: `integration/pr2248-pr2255-clean` from `origin/main`.
2. Bring in PR `2248` outcomes first (because AI/Neon final preference is anchored there).
3. Add PR `2255` outcomes in scoped slices (notifications, signal-team UX, coherence boards/cards), avoiding broad squash merges.
4. For each overlapping file, resolve with explicit precedence rules:
   - AI behavior: prefer `2248` unless `2255` contains an isolated fix needed for acceptance.
   - Mention flow/security fixes: prefer the safest typed/authenticated variant.
   - Coherence signal card visual final state: use latest accepted UX outcome, then re-run accessibility checks.

Exit gate: branch compiles and no unresolved overlap decisions remain undocumented.

### Phase 3: Neon/Postgres Hardening Pass

1. List all DB artifacts touched by both PR lines (schema, indexes, constraints, migrations, runtime DB calls).
2. Keep only final-state migrations that are forward-safe from `main`.
3. Remove duplicate or superseded index/migration steps introduced by iteration.
4. Validate:
   - migration order and idempotency
   - rollback strategy for latest migration batch
   - query-path index coverage for signal orchestration and memory reads
5. Run a DB review checklist (correctness, performance, security, observability).

Exit gate: one coherent migration path, no conflicting/superseded DB steps.

### Phase 4: Regression Test Matrix (Risk-Driven)

Run tests in this order, blocking on failures:

1. Static and CI parity:
   - `check-types`
   - lint/format checks
2. Targeted unit/integration:
   - mention notification dispatch + consent enforcement
   - AI chat route stream conversion and error fallback behavior
   - matrix token/session hooks and provider lifecycle behavior
3. E2E critical flows:
   - AI panel send/stream/retry
   - coherence signal thread mentions and team access controls
   - signal card/grid responsive rendering
   - notification center consent save/reload
4. Accessibility checks on modified surfaces (notification center, signal cards, onboarding hero updates).

Exit gate: all required checks green; no known sev-1/sev-2 regressions.

### Phase 5: PR Hygiene and Launch Readiness

1. Open one PR to `main` with:
   - domain-grouped commit history (not noisy fixup chain)
   - overlap resolution log
   - DB migration rationale
   - explicit test evidence links
2. Mark PR as merge-blocked unless:
   - required CI is green
   - reviewer sign-off from app, DB, and QA perspectives is complete
3. Prepare go-live runbook:
   - migration execution order
   - rollback triggers
   - post-deploy smoke checks and ownership

Exit gate: merge-ready PR with clear rollout and rollback plan.

## Conflict Resolution Rules (Non-Negotiable)

- Do not auto-resolve overlap files without side-by-side review.
- Do not include temporary debug/docs artifacts generated during back-and-forth iterations.
- Do not carry stale branch-local fixes that are already superseded by later commits.
- Do not merge when `check-types` is red, even if deploy preview passes.

## Deliverables

1. One integration PR against `origin/main` containing the consolidated final implementation.
2. Overlap decision log (file-level, with rationale).
3. DB final-state migration map.
4. Regression evidence pack (CI + targeted e2e outcomes).

## Proposed Owner Checklist

- [ ] Engineering lead: approve overlap decisions
- [ ] DB owner: approve Neon/Postgres final-state pass
- [ ] QA owner: approve regression matrix completion
- [ ] Product/design owner: approve final coherence + notification UX
- [ ] Release owner: approve go-live and rollback runbook

