---
name: hypha-brief
description: "Draft a shareable summary of work — a daily update, a spec brief for the team, or a focused issue to run by the team. Three auto-detected modes: daily (recent work + next steps), spec (spec summary + acceptance criteria), issue (specific topic to raise). Writes to .hypha-context.local/briefs/ (local draft — developer decides what to share). Trigger when someone says: 'generate a brief', 'draft something to share', 'share my daily update', 'brief the team on this spec', 'I want to run this by the team', or 'create a brief for the team call'."
---

# hypha-brief

Draft a shareable summary of current work. Output is always a **local draft** — gitignored,
written to `.hypha-context.local/briefs/`. The developer decides what to do with it.

## Three modes (auto-detected)

| Mode | When | Core content |
|---|---|---|
| **daily** | No active spec / general catch-up | Recent work + next steps |
| **spec** | `spec-active.local.md` exists in satellite | Spec summary + acceptance criteria + links |
| **issue** | Dev specifies a topic or question | Context + the issue + ask for the team |

Pass a focus as args to override: `/hypha-brief [what to focus on]`

If mode is ambiguous, ask one clear question — not a form.

## Steps

### 1. Detect mode
- Check for `.hypha-context.local/spec-active.local.md`. Present → lean `spec`.
- Developer specified a focus → lean `issue`.
- Neither → `daily`.

### 2. Check push status (spec mode only)
Verify whether the relevant spec has been committed and pushed to `hypha-context`:
```bash
cd ../hypha-context && git status && git log --oneline -3
```
**If not yet pushed:** flag before drafting:
> *"The spec for #X hasn't been pushed yet — any links in the brief will point to content the
> team can't see. Checkpoint first, or include a draft banner in the brief?"*
Let the developer decide. Never auto-commit. If they say "add a note", add `> DRAFT — spec not yet pushed` at the top.

### 3. Gather content

**Daily:** Read `activity_log_path` from `.hypha-context.local/pointers.md` — last 1–2 entries.
Read `spec-active.local.md` if present for any open threads. Ask if anything specific to add.

**Spec:** Read `spec-active.local.md` — Goal, Acceptance criteria, Status sections.
Pull ticket id and GitHub issue link from the spec header. Distil; don't reproduce the full spec.

**Issue:** Ask (if not already clear):
> *"What's the issue? What context should I give the team, and what do you want from them?"*

### 4. Draft the brief

---

#### Daily template
```markdown
# Daily Update — {date}

**Developer:** {display_name}

## Recent work
{2–4 bullets — specific: "finished Y", "unblocked Z", "decided A". Not "worked on X".}

## Next up
{1–3 bullets.}

## Open questions (optional)
{Anything the team could help with.}
```

---

#### Spec template
```markdown
# Spec Brief — #{ticket_id}: {title}

> **Status:** {phase + frozen/in-progress} · **Last touched:** {date}
> **Issue:** {GitHub URL — or "draft, not yet public" if not pushed}

## What we're building / deciding
{2–3 sentences. Plain language, no jargon.}

## Acceptance criteria (done-when)
{Verbatim or lightly cleaned from spec. This is the core of the brief.}

## Where we are
{Current phase, what's done, what's next — 2–3 sentences.}

## What I'd like from the team (optional)
{If sharing for input: specific ask.}
```

---

#### Issue template
```markdown
# Brief — {short title}

> **Context:** #{ticket_id} — {title} (if applicable) · **Date:** {date}

## Background
{What's being worked on — 2–3 sentences.}

## The issue / question
{Direct. What you want to run by the team.}

## Relevant links
{Spec, ticket, PR, or code link if applicable.}

## What I'd like from the team
{A decision, a review, a reaction, a heads-up.}
```

---

### 5. Show and confirm
Show the draft. Ask: *"Does this capture what you want to share? Anything to adjust?"*
Apply edits, then write.

### 6. Write the file
**Path:** `.hypha-context.local/briefs/YYYY-MM-DD-{mode}-{slug}.md`
Create the `briefs/` subdirectory if it doesn't exist. Gitignored — never committed.

### 7. Confirm
Tell the developer where the file is. Offer next steps by mode:
- **Daily:** paste into Slack or share directly
- **Spec:** if spec not pushed, suggest `/hypha-checkpoint` first so links work
- **Issue:** ask if anything else to add before sharing

---

**Canonical procedure:** `../hypha-context/workflow/brief.md`
