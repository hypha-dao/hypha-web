---
name: hypha-cadence-input
description: "Add to, update, or prune the agenda of the next weekly team sync (the #2502 team cadence) — items to discuss, new notes or quotes from teammates on an existing item, items to drop or park. Writes to progress/team-cadence/ in hypha-context. Trigger when someone says: 'let's add an item to discuss #2559', 'update the point about X, Vlad also said ...', 'put this on the agenda for Wednesday', 'drop that item', 'what's on the agenda?'."
---

# hypha-cadence-input

Keeps the current cycle's **Agenda inputs** in the team-cadence record (one file per ISO week,
`YYYY-Www.md`) current. First of three planned cadence skills: **input** (this, before the sync) →
`hypha-cadence-run` (during) → `hypha-cadence-process` (after, from the transcript).

The full procedure lives in `hypha-context` at `workflow/cadence-input.md`; the file shape lives in
`progress/team-cadence/AGENTS.md` there. This is the condensed, satellite-safe version.

## Resolve paths (never hardcode)

- `team_cadence_path` from `.hypha-context.local/pointers.md`; if absent, use
  `<hypha_context_root>/progress/team-cadence` (`hypha_context_root` from the same file, fallback
  the `../hypha-context` sibling).
- If the folder doesn't exist, stop and tell the user to update `hypha-context` (`git pull`).
- Author = `developer` from `.hypha-context.local/personal.md`.

This is a root-level shared path in `hypha-context`, outside `member_progress` — the one place this
skill writes beyond the usual scope. It touches only `team-cadence/`; nothing else there.

## Steps

1. **Target cycle.** The next Wednesday sync's ISO week (`YYYY-Www.md`). If the file doesn't exist,
   create it from the template in `progress/team-cadence/AGENTS.md` and carry in still-open items
   from the previous cycle. State the cycle and sync date you resolved. If the file's `status` isn't
   `collecting`, ask whether the input is for the next cycle; never rewrite a `processed` cycle.
2. **Interpret.** Add (new item `I<n>`), Update (append a dated note; revise the Ask only if the
   framing changed), Remove (status `dropped` with reason, or `parked` to carry over — never delete
   the block), or Show (print the agenda grouped by move and stop).
3. **Item fields:** Title · Kind (`report`/`discuss`/`decide`/`ask`) · Move (`look back`/`make
   sense`/`promise`/`read back`; infer from kind and say so) · Refs (`#2559`, links) · Raised by ·
   Ask (one sentence) · Notes (dated, attributed). Quotes from others are kept **verbatim**, with
   who/where/when. Clean voice-dictated wording but preserve intent. Read an unfamiliar referenced
   issue before writing the Ask; don't invent context.
4. **Write** the file, showing the item or diff. Ask first only if the request was ambiguous (which
   item, which cycle).
5. **Offer to commit + push** in `hypha-context` (not this repo) with a `docs(cadence): …` message;
   commit only on a yes.

## Guardrails

Doesn't decide, assign, or change tickets — the sync does. Keep items to a few lines; anything
bigger is a ticket or a `/hypha-brief`. The cycle file is team-readable: no private notes.
