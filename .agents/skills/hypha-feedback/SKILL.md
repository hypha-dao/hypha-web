---
name: hypha-feedback
description: "Surface an idea, observation, or proposal for team discussion without owning the improvement — creates a committed entry in the shared feedback/ folder in hypha-context. Two flavors: internal (engaged dev flagging something to discuss collectively) or external (any contributor providing input for engaged devs to act on). Trigger when someone says: 'flag this for the team', 'I have feedback on X', 'log this idea without a ticket', 'note this for discussion', 'I want to surface this but not own it'."
---

# hypha-feedback

Surface a team input — an idea, observation, or proposal — as a committed entry in the shared
`feedback/` folder in `hypha-context`. Lower friction than opening a ticket. Entries are
permanent and team-visible once pushed; they're actioned by engaged developers at their cadence.

## Two flavors

- **Internal** — the author is a developer or contributor with some context ownership; wants a
  team discussion before any change is made.
- **External** — the author doesn't conceptually own workflow/context work; providing observations
  or ideas for engaged devs to analyse and act on.

If ambiguous: lean `internal` for profile A/B, `external` for C–F.

## Steps

### 1. Identify the author
- If satellite is present: use `developer` from `.hypha-context.local/personal.md`.
- If no config found: ask for a name or handle to attribute the entry.

### 2. Gather the feedback
If not provided as args, ask one question:
> *"What's the feedback? A sentence is fine — I'll help shape it."*

Then: *"What area or ticket is this about? (or leave blank if general)"*

Optionally: *"Is there a specific question you'd like the team to react to?"*

Keep it lightweight — not a spec. If the author is voice-dictating or informal, clean it up
but preserve intent exactly.

### 3. Draft the entry

```markdown
---
date: {today ISO}
from: {developer_id or name}
type: {internal | external}
area: {area, feature, or ticket # — or "general"}
status: open
---

# {Short title — ≤8 words}

## Context
{What prompted this — 1–3 sentences.}

## Feedback / Proposal
{The core observation or idea. Specific, no polish required.}

## For the team (optional)
{Specific question or framing for the discussion.}
```

Show the draft before writing.

### 4. Write the file

**Path:** Use `feedback_path` from `.hypha-context.local/pointers.md`.
If satellite is absent, use `../hypha-context/feedback/` as the fallback.

**Filename:** `{feedback_path}/YYYY-MM-DD-{developer_id}-{slug}.md`
Slug: 2–4 words from the title, kebab-cased. Use `external` in place of developer_id if unknown.

### 5. Commit and push

Feedback is only useful to the team once committed. Offer:
> *"Ready to commit and push so the team can see it?"*

Commit to **`hypha-context`** (not this repo). Suggested message:
```
feedback: {slug} from {developer_id}
```

### 6. Confirm
Tell the author: what file was written, where, and whether it's live or still local.

---

**If this feedback clearly warrants a full ticket and the author is ready to own it:**
Suggest `/hypha-task-init` instead. This skill is for the "not sure / not owning it" case.

**Canonical procedure:** `../hypha-context/workflow/feedback.md`
**Feedback folder conventions:** `../hypha-context/feedback/AGENTS.md`
