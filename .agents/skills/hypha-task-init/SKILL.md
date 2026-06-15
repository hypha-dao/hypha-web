---
name: hypha-task-init
description: "Scaffold an SDD ticket workspace when starting a new unit of work. Reads the developer config, classifies the task, picks the SDD level, and creates the ticket folder in hypha-context. Trigger when the developer says: 'I'm starting #X', 'let's begin <ticket>', 'new task', or 'starting work on X'. (To resume an in-progress ticket use hypha-task-resume. To wrap up use hypha-checkpoint.)"
---

# hypha-task-init

Scaffold a new SDD ticket workspace at the start of a unit of work. Creates the ticket folder and seed artifacts in hypha-context, logs it to the activity log.

## Dual-repo context

| Repo | Role |
|------|------|
| `../hypha-context` | Ticket artifacts are created here |
| `hypha-web` (this repo) | Code changes happen here |
| `.hypha-context.local/` (this repo) | Satellite — activated at Phase B kickoff |

## Steps

### 1. Sync context
Ensure `../hypha-context` is current. Offer to pull if behind origin.

### 2. Load developer config
Read `../hypha-context/progress/members/gerroza/AGENTS.local.md`.

### 3. Read the GitHub issue
Fetch the issue with `gh issue view <number> --repo hypha-dao/hypha-web`. If no issue exists yet, note it.

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
Create `../hypha-context/progress/members/gerroza/tickets/<issue#>-<slug>/` with the triggered artifacts (spec.md always; others per above). Add a dated entry to the activity log.

### 7. State mode and begin Phase A
State the review mode and decision posture from the config. Draft `spec.md` and close with 3–5 targeted callouts (most debatable last).

---

**Canonical procedure:** `../hypha-context/workflow/task-init.md`
