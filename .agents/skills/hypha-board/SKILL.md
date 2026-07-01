---
name: hypha-board
description: Read or update Hypha's GitHub issues, PRs, and project board (#14 "Hypha Platform — Active Work") via the gh CLI. Use when a technical developer (github.enabled in their config) says "update the board", "sync this to GitHub", "move #X to In Review", "open the PR", "what's assigned to me", or "check GitHub". Also fires as a soft step inside hypha-task-init and hypha-checkpoint. Reads are free; writes ALWAYS confirm first.
audience: dev
---

# hypha-board — GitHub board & issue sync (satellite skill for hypha-web)

**Triggers:** "update the board", "sync this to GitHub", "move #X to In Review", "open the PR",
"what's assigned to me", "check GitHub", creating/closing a ticket.

**Who it's for:** Technical developers with `github.enabled: true` in their general `AGENTS.local.md`.
**Skip silently** for others — never offer it if the gate isn't set.

**Gating (check first):**
1. Developer's general `AGENTS.local.md` has `github.enabled: true` and a technical profile.
2. `gh` CLI is installed and authenticated — run `gh auth status`. Board commands need the `project`
   scope: `gh auth refresh -s project` (offer the command; do not run silently).

**Golden rule:** reads are free; every write states the exact change and asks for a yes first.

---

## Canonical procedure

Full procedure in `hypha-context`: [`workflow/github-sync.md`](../../../../hypha-context/workflow/github-sync.md)

Issue/PR conventions (title format, label taxonomy, board columns, custom fields):
[`planning/issue-guidelines.md`](../../../../hypha-context/planning/issue-guidelines.md)

**Don't duplicate those here.** When in doubt, read them.

---

## Quick reference — this repo

**Repo:** `hypha-dao/hypha-web`

**Project board:** [Hypha Platform — Active Work](https://github.com/orgs/hypha-dao/projects/14) (board #14)

**Board columns:** Backlog → Todo → In Progress → Blocked → In Review → Done

**Issue title convention:** `type(scope): short description` (e.g. `fix(banking): tab count wrong`)

**Label taxonomy (active labels — from issue-guidelines.md):**

| Label | Use for |
|---|---|
| `bug` | Something broken |
| `banking` | All Bridge/fiat banking work |
| `new feature` | Feature or capability addition |
| `chore` | Housekeeping, config, infra |
| `documentation` | Docs, onboarding |
| `analysis` | Design/research with a decision as output |
| `blocked` | Blocked on external dependency |
| `Hotfix` | Needs to ship urgently |
| `AI-Generated Feature` | AI-generated issues (for transparency) |

> For the complete, authoritative list see `planning/issue-guidelines.md` in hypha-context.

---

## Soft-step hooks (fires inside other skills)

- **Inside `hypha-task-init`:** read the linked GitHub issue to ground the spec. If no issue exists
  and the work belongs on the board, *offer* to create one with the correct title/labels/board
  placement — then ask for a yes before creating.
- **Inside `hypha-checkpoint`:** *offer* to reflect the session on GitHub — progress comment,
  board-column move (e.g. In Progress → In Review when a PR opens), label/field updates. State the
  proposed write and wait for a yes.
- **Ad-hoc:** developer says one of the trigger phrases above → run the procedure directly.
