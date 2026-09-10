# Quality Gates

Detailed procedures for the mandatory QA and code-review gates.

## Gate 1: QA (Phase 5)

### Entry criteria

- All implementation subagents in the current iteration have completed
- Changed files are known and listed

### Procedure

1. **Spawn QA subagent** with `senior-qa-test-engineer.base.md` role (see orchestration-patterns.md for prompt template)
2. **QA subagent reviews** all changed files and writes/updates tests where applicable
3. **QA subagent runs** automated checks that match the change:
   - Read **root** `package.json` scripts, **`.agents/AGENTS.md`**, and **`package.json` in touched packages** for canonical commands. Do **not** assume `pnpm run test` exists at the monorepo root (this repo has no root `test` script today).
   - **Lint / types (baseline):** from repo root, `pnpm run lint` and `pnpm exec turbo run check-types` when type safety is in scope.
   - **E2E (Playwright):** when specs under `apps/web-e2e` apply, from repo root e.g. `pnpm exec playwright test --config apps/web-e2e/playwright.config.ts` (may require dev server / `BASE_URL`; see that config).
   - **Package-scoped:** use `pnpm --filter <package-name> <script>` when a workspace package defines `test` or similar.
   - If no automated test target covers the change, run the narrowest available checks, document the gap, and list recommended manual verification.
4. **QA subagent reports** structured results

### Pass criteria

| Criterion | Required |
|---|---|
| All new tests pass | Yes (or N/A when no new tests apply and manual verification is documented) |
| No pre-existing tests broken | Yes |
| Accessibility violations (critical) | Zero |
| Accessibility violations (minor) | Documented |
| Coverage does not decrease | Recommended |

### Failure handling

If QA gate fails:
1. QA subagent documents which tests fail and why
2. Orchestrator creates fix tasks from QA report
3. Orchestrator returns to Phase 4 (implementation) with fix instructions
4. After fixes, re-run Phase 5 from the start

---

## Gate 2: Code Review (Phase 6)

### Entry criteria

- QA gate (Phase 5) has passed for the current iteration
- All changes are saved to disk (no need to commit first — review works on file changes)

### Procedure

1. **Follow the `code-review` skill** for prerequisite checks (CLI install, `coderabbit auth status`). Quick probe:
   ```bash
   coderabbit --version 2>/dev/null || echo "NOT_INSTALLED"
   ```
   If not installed, inform the user and link to https://www.coderabbit.ai/cli

2. **Run review in prompt-only mode** (after auth is OK):
   ```bash
   coderabbit review --prompt-only
   ```
   This outputs minimal, agent-optimized findings.

3. **Parse findings** and classify by severity:
   - **Critical** — security vulnerabilities, data loss, crashes
   - **Warning** — bugs, performance issues, anti-patterns
   - **Info** — style, suggestions, minor improvements

### Pass criteria

| Severity | Gate status |
|---|---|
| Any Critical findings | **FAIL** — must fix |
| Any Warning findings | **FAIL** — must fix |
| Info-only findings | **PASS** — note in PR |
| No findings | **PASS** |

### Failure handling

If code review gate fails:
1. Create a numbered task list from Critical and Warning findings
2. For each finding, identify the responsible domain role
3. Spawn the appropriate implementation subagent(s) to fix
4. After fixes, re-run **both** Gate 1 (QA) and Gate 2 (review)
5. Cap at 3 iteration rounds — if still failing, escalate to user

### When code-review CLI is unavailable

If `coderabbit` is not installed or not authenticated and the user cannot fix that in-session:
1. Log clearly: "Code review gate — CodeRabbit CLI unavailable or not authenticated; running manual review pass per quality-gates.md"
2. Perform a structured manual review: read all changed files; apply severity judgment aligned with the **`code-review` / CodeRabbit** expectations (Critical / Warning / Info)
3. Proceed to delivery only if there are no issues that would have been Critical or Warning under that bar; note in the PR that automated CodeRabbit was not run

---

## Iteration Protocol

Cap **full gate cycles** at **3** (matches orchestration-patterns.md). A cycle = Phase 5 (QA) then Phase 6 (review) for the same tree of changes.

```
max_cycles = 3

for cycle from 1 to max_cycles:
  run Phase 5 (QA gate)
  if QA fails:
    if cycle == max_cycles:
      escalate to user with failing tests / logs; break
    apply fixes from QA report; continue

  run Phase 6 (code review gate)
  if review has Critical or Warning findings:
    if cycle == max_cycles:
      escalate with remaining findings; break
    spawn fixes (Phase 4); continue

  both gates passed → proceed to Phase 7 (deliver); break
```

---

## Gate Checklist (for orchestrator self-verification)

Before proceeding to delivery, confirm:

- [ ] Every implementation subagent committed its changes with a conventional commit message
- [ ] QA subagent was spawned with the full `senior-qa-test-engineer.base.md` role
- [ ] Applicable automated checks were actually executed (not just suggested)
- [ ] Results were reported with pass/fail counts when tests/checks ran, or clearly marked N/A with documented manual verification when no automated target applied
- [ ] QA subagent committed its test changes with a conventional commit message
- [ ] Code review gate satisfied: `coderabbit review --prompt-only` after latest changes **or** documented manual pass when CLI/auth unavailable
- [ ] No Critical or Warning findings remain
- [ ] Iteration count did not exceed 3

After delivery, confirm:

- [ ] Branch was pushed to remote
- [ ] PR was created via `gh pr create`
- [ ] PR URL was returned to the user — **this is the only valid completion signal**
