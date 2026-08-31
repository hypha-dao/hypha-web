---
title: 'The Intelligent Organization — What it is'
date: 2026-08-28
status: draft
tags: [product, intelligent-org, hypha]
---

# The Intelligent Organization — What it is

Source of truth for building the intelligent org on the Hypha platform. This document says what
it is and what users can do thanks to it. A companion document says how to build it.

---

## What intelligent means

An organization is intelligent when it can reliably run one loop:

```
hear what happened
    → remember what it is for
        → put the next action in front of the right person
            → watch what came of it
                → revise what it believes
```

Everything in this document is a feature of that loop.

The test is concrete: **any member opens the app and knows, without asking anyone, what matters
and what to do next.**

Two rules hold everywhere:

1. **The AI drafts. People decide.** The AI never decides money, membership, or what the
   organization believes.
2. **Work is offered, never assigned.** The named person accepts or declines. Decline sends it
   back.

---

## Who is who

| Who        | What they are                                                                    |
| ---------- | -------------------------------------------------------------------------------- |
| **Member** | Joined. No job until they accept one.                                            |
| **DRI**    | Accepted a project (holds the job) or a ticket (does the work). A relationship, not a title. |
| **Shaper** | Sets direction: what the org believes, which projects exist, what they are worth. |

The founder is the first Shaper. One person can be all three at once.

---

## The features

### 1. Direction stays current

Shapers have a standing chat with the org agent. They talk about what the org is for, drop
documents and links, say "we now care about X." The agent drafts the **org brief** and
**objectives**; a Shaper confirms each version.

This is not a one-time founding interview. The chat never closes. Everything else the AI does
reads from the latest confirmed brief.

**A Shaper can:** update what the org believes by talking, any day, and see that reflected in
what the AI suggests next.

### 2. The org listens

Chats, calls, and transcripts are the input. Members talk to each other and work in the open;
the org hears needs, gaps, and commitments as they happen.

Nobody files anything. There is no "new ticket" button.

**A member can:** say "who signs the hall licence?" in a group chat and trust the org heard it.

### 3. Talk becomes work — with authority

The AI drafts work from what it hears. Who can make it real depends on what it is:

| What                  | Who makes it real   | Date it carries          |
| --------------------- | ------------------- | ------------------------ |
| **Project / mandate** | A **Shaper**        | **Review date**          |
| **Ticket**            | The **project DRI** | **Estimated completion** |

If no project covers a need, the draft goes to Shapers. If one does, the ticket draft goes to
that DRI — for themselves or someone on their team. Anyone's talk is context; only the right
role can stamp it live. Same gap mentioned twice stays one card.

When a Shaper approves a project they also indicate a **budget** — what the org is willing to
pay for this job. That is an indication, not a payment (see feature 7).

**A Shaper can:** approve a project the AI suggested, name a DRI, set the budget and review date
— in chat.
**A DRI can:** write "Lea, can you take covers?" and have that become a ticket offer, without a
form.

### 4. Work is offered, never assigned

The named person sees one clear screen: the job, why them, the dates, the budget if any. They
accept or decline. Decline is respected — _not my thing_ or _no room right now_ — and the card
goes back to whoever offered it.

**A member can:** decline work without explaining themselves to the whole org.

### 5. Talk moves work

If someone says on a call or in a channel that a ticket is done, the agent drafts the done and
posts the receipt: which line, which call. The DRI one-taps to confirm — or says nothing, and
it confirms itself after a quiet window. The AI never flips state on its own; no silent state
changes.

Done first; other obvious moves (took it, dropped it) later.

**A DRI can:** finish work by saying so where they already talk, and see the board agree.

### 6. Everyone has a home

Three surfaces, one glance each:

| Surface      | What it answers                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| **My Work**  | What do I hold, what am I doing, what can I take? Dates on every card.           |
| **All Work** | Who is working on what? Every project and ticket, DRI or *open*, dates visible.  |
| **Org**      | Who are we? Brief, established, founder, Shapers, members, who holds which job.  |

Empty states say so: *Nothing needs you.*

**Anyone can:** see the whole org — who shapes, who holds, what is open — without asking.

### 7. Money stays in the proposal system

Work flow and money flow are **separate**.

A project carries a budget the Shaper indicated. That number is a commitment of intent — it
tells the DRI what the job is worth and tells the org what was promised. The actual payment
happens later, through Hypha's existing proposal and treasury system, referencing the project
and what was done.

The AI never moves money. It can draft the payment proposal when work completes — a person
still takes it through governance.

**A DRI can:** see what a job is worth before accepting it, and point at the finished work when
the payment proposal is made.

### 8. Reviews write themselves

Every project has a review date. When it arrives, the Shaper gets the story prepared: what was
held, what was done, what was not, how it compares to the budget indicated. They extend, resize,
close, or re-offer — in the same chat.

**A Shaper can:** review a project in minutes because the evidence is already assembled.

### 9. Ask the org anything

"Have we dealt with this before?" gets an answer with receipts — the threads, the decisions,
the outcomes. The org remembers what it tried and what happened, not just what was said.

**Anyone can:** ask at 2am and get the history, the root cause, and who shipped the fix.

### 10. Newcomers land somewhere real

A new person builds their profile by talking — social links, what they like to do. What happens
next depends on how they arrived:

- **No specific Space in mind.** The AI suggests Spaces that might fit — based on their profile:
  purpose, place, the kind of work they like. They pick one and join from its public page.
- **Invited into a specific Space.** They land there as a member, nothing more. The AI tells
  them: *"I'll let the others know about your skills and that you're available for work."* The
  org now knows who they are; offers come when there is a fit.

No work queue on day one. The path is stranger → member → DRI, one accept at a time.

**A newcomer can:** arrive knowing nobody and be findable for work that fits — without applying
for anything.

---

## What this is not

- Not automation of decisions. Every consequential state change has a human confirm.
- Not a chat product with a bot. The chat is how the org perceives; the loop is the product.
- Not a payment system. Money moves through proposals, as it does today.

---

## Related

- [Intelligent Org — Exploration](./intelligent-org-exploration.md) — how we got here, Buzz vs Hypha
- [Intelligent Org — Buzz additions](./intelligent-org-buzz-additions.md) — the Buzz fork sketch this supersedes for Hypha
- [Organizational Intelligence — Memory Architecture](../architecture/organizational-intelligence.md) — the memory that makes feature 9 possible
- [The Intelligent Organization — Current State](../architecture/intelligent-org-current-state.md) — what is shipped vs designed
- [The Intelligent Organization — Design](../architecture/intelligent-org-design.md) — how to build the features above
