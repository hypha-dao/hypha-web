---
name: hypha-task-init
description: "Scaffold an SDD ticket workspace when starting a new unit of work. Reads the developer config, classifies the task, picks the SDD level, and creates the ticket folder in hypha-context. Trigger when the developer says: 'I'm starting #X', 'let's begin <ticket>', 'new task', or 'starting work on X'. (To resume an in-progress ticket use hypha-task-resume. To wrap up use hypha-checkpoint.)"
---

# hypha-task-init

Scaffold a new SDD ticket workspace at the start of a unit of work. Creates the ticket folder and seed artifacts in hypha-context, logs it to the activity log.

## Path resolution

Resolve these once from `.hypha-context.local/pointers.md` (this developer's machine-specific paths).
Never hardcode a person's folder or assume a directory layout.

- `{hypha_context_root}` ← `hypha_context_root` (fallback: `../hypha-context`)
- `{member_progress}` ← `member_progress` (fallback: `{hypha_context_root}/progress/members/<developer>`, where `<developer>` is `developer` in `{hypha_context_root}/AGENTS.local.md`; if it can't be determined, ask — never use another member's folder)
- `{platform_progress}` ← `platform_progress` (fallback: `{hypha_context_root}/progress/platform`)

## Dual-repo context

| Repo | Role |
|------|------|
| `{hypha_context_root}` | Ticket artifacts are created here |
| `hypha-web` (this repo) | Code changes happen here |
| `.hypha-context.local/` (this repo) | Satellite — activated at Phase B kickoff |

## Steps

### 1. Sync context
Ensure `{hypha_context_root}` is current. Offer to pull if behind origin.

### 2. Load developer config
Read `{member_progress}/AGENTS.local.md`.

### 3. Read the GitHub issue (board soft-step — gated)

If the developer's general `AGENTS.local.md` has `github.enabled: true`, use the `hypha-board`
skill: fetch the issue with `gh issue view <number> --repo hypha-dao/hypha-web` to ground the
spec. If no issue exists yet and the work belongs on the board, *offer* to create one (correct
`type(scope):` title, labels per `{hypha_context_root}/planning/issue-guidelines.md`, add to project
#14, set Priority/Target date) — state the proposed write and wait for a yes before creating.
Skip this step silently if `github.enabled` is absent or false.

### 4. Classify the task (skip any already answered by the issue/config)

- **Type:** analysis · feature · bug · process
- **Reviewer:** will another contributor review before merge?
- **Discovery:** is research needed, or is the area already understood?
- **Phasing:** one pass, or multiple distinct phases?

### 5. Pick the SDD level (escalation triggers)

| Add this artifact | When |
|---|---|
| `spec.md` | always |
| `analysis.md` | discovery happened — living findings, open questions |
| `inputs/` | discovery research material exists |
| `brief.md` | analysis ticket producing a team-facing recommendation |
| `implementation-plan.md` | Phase B uses AI-assisted implementation |
| `decisions.md` | more than 2 non-obvious decisions expected |
| `acceptance.md` | criteria automated as tests or separate sign-off |
| `.local/` | heavy/private working material (gitignored) |

### 6. Scaffold the folder
Create `{member_progress}/tickets/<issue#>-<slug>/` with the triggered artifacts (spec.md always; others per above). Add a dated entry to the activity log.

### 7. State mode and begin Phase A
State the review mode and decision posture from the config. Draft `spec.md` and close with 3–5 targeted callouts (most debatable last).

---

**Canonical procedure:** `{hypha_context_root}/workflow/task-init.md`
