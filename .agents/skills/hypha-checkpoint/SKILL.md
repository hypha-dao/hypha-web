---
name: hypha-checkpoint
description: "Record progress at a checkpoint — end of session/day, after a milestone or PR, at a phase transition. Updates ticket spec header, decisions, and activity log in hypha-context; updates the platform view; commits and pushes both repos. Trigger when the developer says: 'let's checkpoint', 'wrap up for the day', 'update the status and activity log', or 'record where we are'."
---

# hypha-checkpoint

Record what happened since the last checkpoint and fold it back into the shared artifacts. The closing bookend of every session.

**Explicit invocation rule:** when the developer explicitly invokes this skill, **commit and push immediately** — do not ask for confirmation. Only pause if something is genuinely off (unexpected files staged, `.local/` content included, conflicts). For proactive/automatic firings, offer first.

## Dual-repo context

| Repo | Artifacts to update |
|------|---------------------|
| `hypha-context` (path from satellite) | spec.md header, decisions.md, activity-log.md, platform view |
| `hypha-web` (this repo) | code changes; satellite `.hypha-context.local/` spec-active state |

**Resolve the developer first (never hardcode a member path):**
1. Read `.hypha-context.local/pointers.md` → `hypha_context_root`, `member_progress`, `activity_log_path`, `platform_progress`.
2. Read `.hypha-context.local/personal.md` → developer id, review mode, decision posture.
3. Then read `{hypha_context_root}/AGENTS.local.md` and `{member_progress}/AGENTS.local.md`.
4. If the satellite is missing: ask which member folder to use. Do **not** fall back to another developer's path.

Write only under `member_progress` (and `platform_progress` only when the work actually moved an area). Never write to another member's folder.

A checkpoint may commit to **both repos** — hypha-web first (code), then hypha-context (spec/log). Run `git status` in both before closing.

## Steps

### 1. Establish the watermark
Read the last dated entry in `{activity_log_path}`. Everything since that entry is uncaptured. Reconstruct from the session conversation and current git state.

### 2. Verify acceptance criteria (before marking Complete)
If a ticket is about to move to Complete, re-read its `spec.md` acceptance criteria and confirm each is verifiably met. If any are unmet, record as open threads instead.

### 3. Update ticket artifacts (only what actually moved)

| Artifact | Update when |
|---|---|
| `spec.md` header | Status / SDD phase / Last touched changed — always touch |
| `spec.md` body | Only if still pre-Commitment-Gate (frozen spec = no body edits) |
| `decisions.md` | Non-obvious decisions made this session |
| `analysis.md` | Discovery/investigation continued |

### 4. Append to activity log
Add a dated entry (newest first) to `{activity_log_path}`. Terse, factual, linking to the ticket spec/decisions and GitHub issue/PR.

### 5. Update the platform view
If the work advanced a platform area, update the matching `{platform_progress}/features/<area>.md`. Only touch areas with real movement. Ask before writing outside `member_progress`.

### 6. Satellite — park or deactivate spec
- **Ticket Complete:** move `spec-active.local.md` content to `specs-done-cache.local.md` (set `context-wrapup-done: true`), clear `spec-active.local.md`, update `pointers.md`.
- **Session wrap, ticket ongoing:** auto-park `spec-active.local.md` to `specs-parked.local.md` (no need to ask). Set `context-wrapup-done: true` after push confirmed.

### 7. Run git status in both repos, then commit and push
Check both `hypha-web` and `{hypha_context_root}`. Flag any unstaged changes. Heavy/private material in `.local/` is never committed. Then commit and push (explicit invocation = do this immediately without asking).

### 8. Surface open threads
State: where we are, what's next, anything blocked.

---

**Canonical procedure:** `{hypha_context_root}/workflow/checkpoint.md`
