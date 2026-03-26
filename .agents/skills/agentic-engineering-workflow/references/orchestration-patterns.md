# Orchestration Patterns

Subagent prompt templates and parallelization guidance for the agentic engineering workflow.

**Tooling:** Prefer the **Task** tool to spawn subagents (parallel = one message with multiple Task invocations). If Task is unavailable, run the same role sequence in a single session instead.

## Subagent Prompt Template

Every subagent prompt follows this structure. Replace placeholders with actual content.

```
ROLE IDENTITY
─────────────
{paste full contents of the selected role file from `.agents/roles/` — typically `*.base.md`; exceptions include `i18n-engineer.md`}

TASK
────
You are working as part of an orchestrated engineering team. Your specific assignment:

{describe the specific scope this subagent owns — files, features, constraints}

CONTEXT
───────
Repository: {repo path}
Branch: {current branch}
Related files: {list files this subagent should read/modify}
Dependencies on other subagents: {what this subagent can assume is done or will be done}

CONSTRAINTS
───────────
- Only modify files within your assigned scope
- Follow the role's output standards
- Report completion status and any blockers
- If you encounter issues outside your domain, document them — do not attempt cross-domain fixes

COMMIT REQUIREMENT
──────────────────
You MUST commit your changes before reporting completion. Follow these steps:
1. Run `pnpm run format:fix` from the repo root (skip if script not present)
2. Stage ONLY the files within your assigned scope
3. Write a conventional commit message:
   - Format: <type>(<scope>): <subject>
   - Use imperative present tense, no capital first letter, no trailing period
   - Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
   - Scope: the affected area as a lowercase noun (e.g., auth, api, i18n, ui)
4. Commit using a HEREDOC for the message
5. Report the commit hash in your completion summary

DELIVERABLES
────────────
{list what this subagent must produce — code changes, test files, config updates, etc.}
Each subagent's output MUST include a committed change (git commit hash).
```

## Parallelization Rules

### Safe to parallelize (no shared file dependencies)

Launch these subagents in a single message with multiple Task calls:

- UI component work + API route work (different file trees)
- Database migration + i18n translations (independent domains)
- Security audit (read-only) + any implementation subagent

### Must run sequentially (dependency chain)

- Database schema changes → API routes that use new schema
- API route changes → UI components that consume new API
- Any implementation → QA gate → Code review gate

### Parallel execution pattern

```
Message 1 (parallel):
  Task A: Fullstack Engineer — implement API route
  Task B: UI/UX Engineer — implement component shell (with mock data)
  Task C: i18n Engineer — add translation keys

Message 2 (after A completes):
  Task D: UI/UX Engineer — wire component to real API
  Task E: Security Engineer — review auth/input handling

Message 3 (after all implementation):
  Task F: QA Engineer — write tests, run suite

Message 4 (after QA passes):
  Orchestrator runs code-review gate (see quality-gates.md): CodeRabbit CLI or documented fallback
```

## QA Subagent Prompt Template

The QA subagent always receives this specialized prompt:

```
ROLE IDENTITY
─────────────
{paste full contents of senior-qa-test-engineer.base.md}

TASK
────
You are the QA gate for an orchestrated engineering workflow. Review all changes
made by the implementation team and ensure quality.

CHANGED FILES
─────────────
{list all files modified by implementation subagents}

SCOPE
─────
1. Review changed files for testability and correctness
2. Write or update tests (where applicable):
   - Playwright E2E tests for user-facing flows
   - Vitest unit tests for logic, utilities, hooks
   - Accessibility assertions (axe-core) for any page/component changes
   - If no automated test target covers the change (e.g., docs-only), run the narrowest available checks and document manual verification + gap
3. Run applicable automated checks (discover scripts from repo root `package.json`, `.agents/AGENTS.md`, and touched packages — see quality-gates.md; this monorepo has no root `test` script)
4. Report:
   - Tests written (file paths)
   - Test results (pass/fail counts)
   - Coverage delta (if measurable)
   - Accessibility violations found
   - Recommended manual testing (if any)

CONSTRAINTS
───────────
- Use resilient, user-facing locators (getByRole, getByLabel, getByText)
- Follow the testing pyramid — prefer unit tests for logic, E2E for flows
- Do NOT mark tests as passing if they actually fail
- Include accessibility assertions for every page visit

COMMIT REQUIREMENT
──────────────────
After writing/updating tests and verifying they pass, commit your test changes:
1. Run `pnpm run format:fix`
2. Stage test files and any test fixtures/helpers you created
3. Commit with format: test(<scope>): <subject>
4. Report the commit hash in your results
```

## Code Review Gate Pattern

The orchestrator (not a subagent) runs this directly. Use the full **`code-review`** skill for install/auth troubleshooting; minimal flow:

```bash
# Prerequisite check
coderabbit --version 2>/dev/null || echo "NOT_INSTALLED"

# Run review in prompt-only mode (optimized for agent consumption)
coderabbit review --prompt-only
```

If the CLI is missing or not authenticated, follow **quality-gates.md** (CLI-unavailable fallback) instead of skipping the gate.

### Interpreting results

| Finding severity | Action |
|---|---|
| Critical | MUST fix — return to implementation phase |
| Warning | SHOULD fix — return to implementation phase |
| Info | OPTIONAL — note in PR description, proceed to delivery |
| Clean (no findings) | Proceed to delivery |

### Iteration loop

```
while review has Critical or Warning findings:
  1. Create fix task list from findings
  2. Spawn implementation subagent(s) to fix
  3. Re-run QA gate (Phase 5)
  4. Re-run code review gate (Phase 6)
```

Cap iterations at 3. If still failing after 3 rounds, report remaining findings to the user and ask for guidance.

## Delivery Pattern

When all gates pass, the orchestrator handles delivery directly (not via subagent). **This phase is mandatory — the workflow does not end until a PR is opened.**

### Commit (if needed)

Subagents commit their own changes during execution. If any uncommitted changes remain after the gate cycle (e.g., review-fix leftovers):

1. Run `pnpm run format:fix` from repo root (skip if not present)
2. Stage remaining changed files
3. Follow `conventional-commits` skill for message format
4. Commit

### Push + PR (always)

1. Push the branch: `git push -u origin HEAD`
2. Create the PR using `gh pr create` (follow `gh-cli` skill):
   ```bash
   gh pr create --title "<type>(<scope>): <subject>" --body "$(cat <<'EOF'
   ## Summary
   <what changed and why, organized by domain>

   ## Roles involved
   <which specialist roles contributed>

   ## Test results
   <pass counts, coverage, accessibility status>

   ## Code review
   <"Clean" or "Info-only findings: {list}">

   EOF
   )"
   ```
3. **Return the PR URL to the user** — this is the signal that the workflow is done

> **CRITICAL:** Do NOT ask "should I create a PR?" — always create it. Do NOT stop after committing. The PR URL is the only valid completion signal.
