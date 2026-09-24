---
name: hypha-task-resume
description: "Resume an in-progress Hypha ticket in a new session. Loads ticket context from hypha-context, assesses the current SDD phase, copies the frozen spec into the satellite, and briefs what's next. Trigger when the developer says: 'I'm continuing #X', 'let's resume X', 'I'm back on this ticket', 'picking up where I left off', 'continue #X', or when starting Phase B after Phase A was completed."
---

# hypha-task-resume

Resume work on an existing Hypha ticket in a new Cursor session. This is the session opener for ongoing work — it orients the AI, surfaces open threads, and picks up where the last session left off.

## Dual-repo context

| Repo | Role |
|------|------|
| `hypha-context` (path from satellite) | Ticket artifacts — spec, decisions, activity-log, implementation-plan |
| `hypha-web` (this repo) | Code changes |
| `.hypha-context.local/` (this repo) | Satellite — who this developer is, active spec copy, workflow pointers |

**Resolve the developer first (never hardcode a member path):**
1. Read `.hypha-context.local/pointers.md` → `hypha_context_root`, `member_progress`, `activity_log_path`.
2. Read `.hypha-context.local/personal.md` → developer id, review mode, decision posture.
3. Then read `{hypha_context_root}/AGENTS.local.md` and `{member_progress}/AGENTS.local.md`.
4. If the satellite is missing: ask which member folder to use. Do **not** fall back to another developer's path.

Write only under `member_progress`. Never write to another member's folder.

## Steps

### 1. Sync context
Check that `{hypha_context_root}` is on `main` and up to date. If behind origin, offer to pull (don't force if there are local changes).

### 2. Load developer config
Read `{member_progress}/AGENTS.local.md` for review mode, decision posture, engagement profile, verbosity.

### 3. Load the ticket
Ask for the ticket number/slug if not provided. Then read:
- `{member_progress}/tickets/<id>-<slug>/spec.md` — goal, acceptance criteria, Status header, SDD phase, Last touched
- Last entry in `{activity_log_path}` — the watermark
- `decisions.md` (if present) — what's already been decided
- `implementation-plan.md` (if present and Phase B is active or upcoming)
- `analysis.md` (if present) — open questions still in play

### 4. Assess current phase

| Phase | Status in spec header | Meaning |
|---|---|---|
| Phase A — Coherence | Spec Draft / In Discovery | Spec still being written |
| Commitment Gate | Spec frozen / Pending sign-off | Locked; implementation not started |
| Phase B — Action | In Progress / Implementing | Code being written against the spec |
| Phase C — Loop return | In Review / Wrapping up | Implementation done; reviewing |
| Done | Complete | Ticket closed |

### 5. Satellite — Phase B spec copy
If the ticket is entering or in Phase B:
- Check `.hypha-context.local/spec-active.local.md` — is the current spec already there?
- If not, copy the frozen spec into `spec-active.local.md` and update `pointers.md` (set `active_ticket_id`).
- If already there, verify it matches the current `spec.md` (refresh if stale).

Skip for Phase A tickets (spec not yet frozen).

### 6. Brief the session
State clearly:
- **Where we are:** current phase, spec status, what was last done (from the activity-log watermark)
- **Open threads:** unresolved questions, pending decisions, items flagged at last checkpoint
- **What's next:** the logical next step
- **Mode:** state the review mode and decision posture from the config — never silently

### 7. Proceed
If the next step is clear and the developer said "let's continue", start on it. If there's ambiguity, surface the options and ask. Do not re-scaffold — the ticket folder already exists.

---

**Canonical procedure:** `{hypha_context_root}/workflow/task-resume.md`
