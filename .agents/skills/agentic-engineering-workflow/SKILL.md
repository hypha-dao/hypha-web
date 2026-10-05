---
name: agentic-engineering-workflow
description: |
  Orchestrate multi-role engineering workflows using subagents. Acts as an agent team
  lead that analyzes tasks, selects specialist roles, spawns parallel subagents, and
  enforces mandatory QA and code-review gates. Use when the user asks to implement a
  feature end-to-end, build something that crosses multiple domains (frontend, backend,
  database, security, i18n), run an agentic workflow, orchestrate agents, or requests
  "full-stack delivery" / "ship this feature". Also trigger when the task clearly
  requires more than one specialist role. Do NOT use for single-domain tasks that a
  single role handles well (e.g., only writing tests, only translating, only reviewing).
---

# Agentic Engineering Workflow

Orchestrate specialist agent roles and quality-gate skills to deliver engineering tasks end-to-end.

## Purpose

This skill turns a single user request into a coordinated multi-agent execution plan. It selects the right specialist roles from `.agents/roles/`, composes subagent prompts, enforces mandatory QA testing and code review after every change, and iterates until quality gates pass before creating a PR.

## When to Use / When NOT to Use

**Use when:**
- The task spans multiple domains (UI + API + DB + tests + i18n …)
- The user says "implement", "build", "ship", "deliver end-to-end"
- Multiple specialist perspectives are needed for quality
- The user explicitly asks for an agentic or orchestrated workflow

**Do NOT use when:**
- A single role handles the entire task (just activate that role directly)
- The user asks only for a review, only for tests, only for translations
- The task is exploratory or informational (no code changes)

---

## Workflow

Follow every step. Scale depth to task complexity, but never skip a step.

### Phase 1 — Analyze

1. Parse the user's request into **goal**, **scope**, and **acceptance criteria**
2. Identify affected domains: UI, API, database, auth/security, i18n, CI/CD, testing
3. List files and areas likely to change (if uncertain, use a **Task** subagent with `subagent_type: explore`, or search the repo directly)

### Phase 2 — Select Roles

Map affected domains to roles using the catalog below. Read each selected role file from `.agents/roles/` before composing subagent prompts.

| Domain | Role file (in `.agents/roles/`) | Always? |
|---|---|---|
| Frontend / UI / components | `senior-ui-ux-design-engineer.base.md` | No |
| Next.js / API / fullstack | `senior-lead-fullstack-nextjs-engineer.base.md` | No |
| Database / Drizzle / Neon | `senior-neon-db-engineer.base.md` | No |
| Security / auth / OWASP | `senior-application-security-engineer.base.md` | No |
| Translations / i18n | `i18n-engineer.md` (+ `i18n-translate` skill) | No |
| CI/CD / GitHub Actions | Use `engineering-github-actions` skill | No |
| **QA / Testing** | **`senior-qa-test-engineer.base.md`** | **YES — always** |

> **MANDATORY:** The Senior QA / Test Engineer role participates in every workflow, regardless of task type. If the task appears too small for QA, run a minimal verification pass anyway.

For the detailed role-to-domain mapping with selection heuristics, see [references/role-catalog.md](references/role-catalog.md).

### Phase 3 — Plan Execution

Define an **execution roadmap** (this is the plan; Phases 4–7 are the numbered steps that implement it):

```
1. Implementation (Phase 4) — parallel where independent
   → One Task subagent per domain role (fullstack, UI, DB, i18n, …)
   → Each prompt includes: full role file + scoped task + file paths/constraints

2. QA gate (Phase 5) — after implementation (and after each fix loop)
   → QA Task subagent with senior-qa-test-engineer role
   → Writes/updates tests, runs applicable suite, reports results (see quality-gates.md)

3. Code review gate (Phase 6) — after QA passes for this iteration
   → Follow code-review skill: check CLI, then `coderabbit review --prompt-only`
   → If CLI unavailable, use fallback in quality-gates.md (never fabricate a clean review)

4. Fix loop — if Critical or Warning findings (or QA failure)
   → Address findings, then repeat steps 2–3 (cap iterations; see quality-gates.md)

5. Deliver (Phase 7) — when gates pass
   → conventional-commits skill + gh-cli skill for PR
```

For subagent prompt templates and parallelization guidance, see [references/orchestration-patterns.md](references/orchestration-patterns.md).

### Phase 4 — Execute

Spawn specialist work through the **Task** tool (Cursor’s subagent / delegated-task mechanism — same capability, different labels in some clients).

**If the Task tool is unavailable:** run the roadmap sequentially in one session: adopt each selected role from `.agents/roles/`, complete that scope, then move to the next role and finally run QA and review yourself.

1. **Read the role file** for each selected role before composing the subagent prompt
2. Compose a subagent prompt that includes:
   - The full role identity from the role file
   - The specific task scope for this subagent
   - File paths and constraints relevant to this subagent
   - Instruction to follow the role's output standards
   - **Commit requirement:** the subagent must commit its changes using the `conventional-commits` skill before reporting completion (run `pnpm run format:fix` → stage → commit with conventional message)
3. Launch independent subagents **in parallel** (single message, multiple Task calls)
4. Wait for all subagents in the current phase to complete before starting the next phase

### Phase 5 — QA Gate (mandatory)

**NEVER skip this phase.** After any code changes:

1. Spawn a QA subagent with the `senior-qa-test-engineer.base.md` role
2. The QA subagent must:
   - Review all changed files for testability
   - Write or update tests (Playwright E2E for flows, Vitest for units) where appropriate
   - Run applicable automated checks per [references/quality-gates.md](references/quality-gates.md) and report results
   - Flag accessibility violations (axe-core)
3. If tests fail → return to Phase 4 with fix instructions

### Phase 6 — Code Review Gate (mandatory)

**NEVER skip this phase** (if CodeRabbit CLI is missing, use the manual fallback in [references/quality-gates.md](references/quality-gates.md) — do not pretend automated review ran).

After every change and before creating PRs:

1. Follow the **`code-review`** skill: verify `coderabbit` is installed and authenticated (`coderabbit --version`, `coderabbit auth status` as in that skill)
2. Run: `coderabbit review --prompt-only`
3. Parse the output for Critical and Warning findings
4. If Critical or Warning findings exist:
   - Create a fix task list
   - Return to Phase 4 to address findings
   - Re-run Phase 5 (QA) and Phase 6 (review) after fixes
5. Proceed to Phase 7 only when review returns clean or Info-only findings (or the documented CLI-unavailable fallback is complete and noted for the PR)

### Phase 7 — Deliver (mandatory — the workflow is NOT done until a PR is opened)

When all gates pass:

1. If any uncommitted changes remain, commit them using the `conventional-commits` skill
2. Push the branch to the remote
3. Use the `gh-cli` skill to **open a PR** with:
   - Summary of changes by domain
   - Test results summary
   - Code review status (clean / info-only)
4. **Return the PR URL to the user** — this is the completion signal

> **The workflow is incomplete until a PR URL has been returned.** Do NOT stop after committing. Do NOT ask the user whether to create a PR — always create it.

---

## Rules

- Do NOT skip the QA gate, even for "trivial" changes — run a minimal verification pass
- Do NOT skip the code-review gate — run CodeRabbit (`coderabbit review --prompt-only`) when the CLI is available; otherwise follow the CLI-unavailable procedure in `references/quality-gates.md`
- Do NOT create a PR until QA passes and code review passes (automated or documented manual fallback)
- Do NOT combine unrelated domains into a single subagent — one role per subagent
- Do NOT fabricate test results — actually run the test suite
- Do NOT end the workflow without an opened PR — Phase 7 is not optional
- Do NOT ask the user "should I create a PR?" — always create it; the PR is the deliverable
- Every subagent MUST commit its own changes using the `conventional-commits` skill before reporting completion
- Always read role files before injecting them into subagent prompts — never paraphrase from memory
- Prefer parallel subagent execution when domains are independent
- When a phase fails, report clearly which gate failed and what needs fixing

---

## Verification

The workflow is complete when ALL of these are true:

- [ ] All implementation subagents committed their changes using conventional-commits format
- [ ] QA subagent ran applicable checks: wrote/updated tests where relevant, executed available automation, and reported pass/fail (or documented why no automated test target applied)
- [ ] QA subagent committed its test additions/changes using conventional-commits format
- [ ] Code review gate satisfied: `coderabbit review --prompt-only` clean or info-only, **or** documented manual review per `quality-gates.md` when CLI is unavailable
- [ ] Branch is pushed to the remote
- [ ] **PR is opened** and the URL has been returned to the user

**If the PR URL has not been returned, the workflow is NOT complete — continue to Phase 7.**

---

## References

- [references/role-catalog.md](references/role-catalog.md) — Full role-to-domain mapping with selection heuristics
- [references/orchestration-patterns.md](references/orchestration-patterns.md) — Subagent prompt templates and parallelization examples
- [references/quality-gates.md](references/quality-gates.md) — Detailed QA and code-review gate procedures
