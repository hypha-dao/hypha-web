---
name: hypha-coderabbit
description: Triage and answer CodeRabbit review comments on an open PR — fix the valid ones, escalate doubtful or high-impact ones for discussion, and reply in-thread to minor wrong ones so CodeRabbit follows up or resolves. Use when a technical developer (github.enabled) says "address the CodeRabbit comments", "handle the review comments", "go through the PR feedback", or "respond to coderabbit". Writes (commits, pushes, replies) confirm once for the batch.
audience: dev
---

# hypha-coderabbit — triage & answer CodeRabbit PR comments (satellite skill for hypha-web)

**Triggers:** "address the CodeRabbit comments", "handle the review comments", "go through the PR
feedback", "respond to coderabbit", "coderabbit left comments".

**Who it's for:** Technical developers with `github.enabled: true` in their general
`AGENTS.local.md`. **Skip silently** for others. Confirm `gh` is authenticated (`gh auth status`).

**Canonical procedure** in `hypha-context`:
[`workflow/coderabbit-review.md`](../../../../hypha-context/workflow/coderabbit-review.md) — read it
and follow it exactly. Don't duplicate it here.

**In this repo:**
- PR repo: `hypha-dao/hypha-web`. CodeRabbit config lives in [`.coderabbit.yaml`](../../../.coderabbit.yaml).
- Before committing fixes, follow the root [`AGENTS.md`](../../../AGENTS.md) for lint/format/test and
  use conventional commits (see the `conventional-commits` skill).
- Prefer this skill over the generic [`autofix`](../autofix/SKILL.md) skill, which applies fixes
  only (no triage, no replies).
