---
title: 'The Intelligent Organization — Design'
date: 2026-08-28
status: draft
tags: [architecture, intelligent-org, ai, memory, hypha]
---

# The Intelligent Organization — Design

How to build the ten features in
[The Intelligent Organization — What it is](../product/intelligent-org-features.md) on the
Hypha platform. That document is the what; this is the how.

---

## Principles

Four rules the whole design hangs on:

1. **The model is a commodity. The memory is the asset.** An AI model has no memory; it knows
   only what we put in front of it. Intelligence is what we write down, who may write it, and
   what we load when. The model stays swappable.
2. **The AI proposes, never publishes.** Nothing the model writes becomes memory or work until
   a human confirm promotes it. Silent AI writes are how hallucination becomes institutional
   truth. Structurally impossible here.
3. **Memory holds interpretation, never readings.** "We are over-exposed to one funding
   source" is memory. "We hold 43,000 USDC" is a reading — fetched live, never stored in a
   belief, or the org recites stale numbers forever.
4. **Every claim carries a receipt.** A suggestion, a done, an answer — each points at the
   events that justify it. No receipt, no trust.

---

## Why this memory design

The options, and why they lose:

| Design                         | Why it fails here                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Everything in the prompt       | Months of chat is millions of tokens. Cost, noise, and gossip ranks equal to decisions.  |
| One big vector search (RAG)    | Similarity has no concept of **authority**. It cannot tell what the org *believes* from what someone once *said*. Embedded AI summaries come back later as fact. |
| Fine-tune the model            | Stale the next day, unauditable, undeletable, welded to one vendor.                      |
| Knowledge graph                | Schema maintenance eats the team. Orgs are too messy for it.                             |
| **Layered memory** (chosen)    | Different rules per layer: who writes, how big, whether it ever reaches the AI.          |

The chosen design — four layers, from
[Organizational Intelligence — Memory Architecture](./organizational-intelligence.md):

|        | Layer         | Holds                                            | Written by                  | Reaches the AI       |
| ------ | ------------- | ------------------------------------------------ | --------------------------- | -------------------- |
| **L1** | Substrate     | every message, transcript, file                  | machines, automatically     | never directly — searched for evidence |
| **L2** | Ledger        | typed facts: *ticket done*, *project approved*   | the system, on state change | as aggregates        |
| **L3** | Beliefs       | org brief, objectives — tens of small documents  | **humans confirm every version** | always, in full |
| **L4** | Outcomes      | suggestion → decision → what happened            | the system                  | selectively          |

L3 is small enough to always sit in the prompt — no retrieval lottery for what the org
believes. L1 is searched only for receipts. That split is what RAG-only designs cannot do.

---

## The layers on Hypha

Where each layer physically lives:

**L1 — substrate.** Uploaded documents exist; chat does **not** — and this is the largest
single build item in the design, not plumbing. Today Postgres holds only coherence room
*metadata* (`roomId`, message counters); the message bodies live on the Matrix homeserver, and
server-side access works through per-user access tokens. There is no appservice, bot, or sync
worker. Getting to "every L1 event lands in Postgres (searchable, FTS) with a stable id" means
building one: a Matrix appservice or bot user with reliable delivery, backfill for existing
rooms, and an explicit privacy decision about mirroring room content into the app database
(which rooms consent, what happens with E2EE). Call transcripts are new too, but they are the
easy half — they arrive through our own ingest. The HEAR pass and features 2, 3, 5, and 9 all
sit on this; treat it as its own project with its own owner.

**L2 — activity ledger.** A Drizzle table (`activity_ledger`): `(space_id, actor, verb,
object_type, object_id, evidence_event_id, created_at)`. The events table already sketched in
the memory architecture — this design makes it real. Every work-object state change writes a
row. Reviews and receipts are queries over this table.

Two decisions this table forces:

- **Relationship to the existing `events` table.** `storage-postgres` already has a
  polymorphic `events` table (`type`, `referenceEntity`, `referenceId`, `params`). Two
  half-overlapping event streams is a split-brain waiting to happen. Either extend `events`
  with the ledger fields, or keep `activity_ledger` separate and state what `events` remains
  for — decide before the first migration, not after.
- **Completeness is enforced, not hoped for.** A ledger with holes is worse than none — reviews
  and receipts would silently lie. "Every state change writes a row" must live in one shared
  mutation helper that every work-object mutation goes through (or a DB trigger), not as a
  convention each mutation remembers.

**L3 — beliefs.** The Space Intelligence artifacts (markdown, versioned, human-approved — PR
#2461). The **Shapers chat** is the write path: the agent drafts a new version, a Shaper
confirms, the version increments. The latest confirmed set is loaded into every agent call for
that space.

**L4 — decision memory.** A Drizzle table (`decision_memory`): what the agent suggested, what
the human decided (accept / amend / reject — amendments are the most valuable signal), and
what the ledger later shows happened. Written by the system on state change. Read selectively
when drafting similar suggestions.

---

## Work objects

Work is **one recursive tree**, not two tables. A project is a ticket with no parent; a ticket
is a piece of work under something. Anyone who holds a piece of work can split it further and
offer the pieces — to any depth. This is what lets a DRI hand a sub-task to a third person
without going back up to the project DRI, and it is what keeps the authority rule simple.

One new table in `storage-postgres`, following the existing schema conventions:

**`work_items`**: `space_id`, `parent_id?` (null = project), `title`, `brief`, `dri_person_id?`,
`due_at?` (review date on a project, estimated completion below it),
`state` (`draft → offered → accepted → in_review → done | declined`), `created_from_event_id`,
`done_evidence_event_id?`. No money column — see "Money" below.

A `depth` column and a materialised `path` (`root_id`, ancestors array) are denormalised for
the board queries — "everything under this project" is one indexed read, not a recursive CTE
on every page load.

Rules enforced in mutations, not in the UI:

- **One promotion rule.** A draft is promoted by whoever holds its parent. At the root the
  parent is the org, so a **Shaper** promotes (and sets the review date). Below the root the
  **parent's DRI** promotes (and sets estimated completion). The same rule applies at every
  depth; there is no separate ticket rule.
- **Holding a piece means you can split it.** A DRI may draft children under their own item and
  offer them. They cannot offer work under an item they do not hold.
- Only the **named person** accepts or declines an offer.
- **Offers expire.** An offer nobody answers renotifies once, then returns to whoever made it
  after a set window. Items stuck in `offered` forever are what erodes trust in My Work.
- **Completion cascades up, never down.** An item with open children cannot be marked done; the
  done draft for it is offered when its last child closes. Marking a parent done does not close
  children. Declining or closing a parent returns its open children to the parent's DRI.
- Every state change writes an L2 row with the evidence pointer.

Boards read the same tree at different cuts: **All Work** groups by root; **My Work** filters by
`dri = me` at any depth and shows the path above each item as a breadcrumb; a project or ticket
page shows its direct children. Depth is a display concern, not a schema concern.

The agent routes drafts with the same rule: a heard need is drafted under the nearest open item
the speaker holds, or the item the talk was about; the draft's `needs:` is that item's DRI. If
nothing covers it, it becomes a root draft and goes to Shapers.

Shapers are a flag on the membership row. Note this is new ground, not a copy of an existing
pattern: the `memberships` table today has no role flags at all (admin is not a DB column), so
this is the first one. The Shapers chat is a private coherence room whose membership mirrors
the flag — a Postgres ↔ Matrix consistency loop that needs an owner: the flag mutation updates
room membership, and a periodic reconcile catches drift.

### Money

For the MVP, **no sum lives on a work item** — no budget indication on projects, no pay on
tickets. Money exists in exactly two places: proposals (the movement) and profiles (the
record of what a person was paid).

How a person gets paid:

1. **Agreed in chat.** Whoever holds the work and whoever holds the item above it name a sum
   where they already talk — a ticket holder with the project DRI, a DRI with a Shaper. That
   line is L1 evidence; the HEAR pass tags it as a pay agreement (L2 `pay_agreed` row pointing
   at the work item and the message), so it can be found later without re-reading the room.
2. **Drafted on request.** When the item is done, anyone involved tells their personal
   assistant "draft a proposal for the Shapers for this work — 150 USDC", or "…whatever we
   agreed". The agent drafts a money proposal carrying the amount, the agreement line, the
   item's done evidence, and its path. If the named sum differs from the agreed line, the draft
   shows both — the agent never silently picks one.
3. **Decided by Shapers.** The proposal goes through the existing proposal/treasury path like
   any other. When it passes, the payment shows on the payee's profile with the agreement and
   the proposal as receipts.

Why this shape: it removes the two hardest design questions (salary vs. per-project, and how
budgets cascade down a tree) from the data model entirely. Pay stays a human conversation; the
system's job is to remember it and turn it into a proposal on demand. If later a community wants
budgets on projects or per-period stipends, those are proposals too — nothing here has to change.

---

## The org agent

Not a chatbot. A pipeline with three passes, running server-side (extend `chat-server` or a
worker beside it — same OpenRouter/AI SDK stack):

```
1. HEAR    new L1 events (Matrix webhook / transcript ingest)
              ↓ batched per room, debounced
              ↓ deterministic pre-filter: only candidate batches go on
2. THINK   agent call: latest L3 (always) + recent room context (L1 window)
           + open work for this space (L2/work_items) + relevant L4
              ↓ outputs structured drafts, or nothing
3. ROUTE   draft → the one person who can make it real
           (Shaper for root items, parent's DRI below that, named DRI for done)
```

The pre-filter matters. The memory architecture names "a model as the proactive trigger" an
anti-pattern — *rules trigger; models explain* — and without a filter, THINK is exactly that,
running on every batch of chat with unbounded cost. So cheap deterministic rules decide which
batches reach the model at all: mentions of open work or its DRIs, question marks addressed to
the room, commitment verbs, activity spikes, transcript ingests. The model then judges
*candidates*, which is judgment, not triggering. This also caps spend: cost scales with
candidate batches, not with everything everyone says.

Pass 2 is deliberately picky on top of that: most candidates still produce nothing. A draft
carries `needs: shaper` or `needs: dri:<person>` — routing is data, and only that person's
confirm mutation promotes it. Duplicate detection: before creating a draft, check open drafts
for the same gap (embedding similarity is fine *here* — it's deduplication, not truth).

Confirm is an ordinary server mutation with the role check, called from a card in the UI or a
reply in chat. Notifications ride the existing OneSignal path.

**Done-from-talk is propose-then-confirm too.** "The ticket becomes done and the DRI can
reopen" would be publish-then-review — an AI write on inferred speech, violating principle 2
exactly where inference is weakest (transcript speaker attribution). Instead, talk produces a
**done draft** with the receipt attached; the DRI one-taps it, or it auto-confirms after a
silent objection window (say 48h) — the same Tier-2 mechanism from the memory architecture.
Same felt experience — say it where you already talk, the board agrees — with no broken
invariant and no silent state change to walk back.

"Ask the org anything" (feature 9) is the same context recipe in reverse: answer from L3 +
live L2 aggregates, search L1 for receipts, cite event ids. Live numbers (treasury) fetched at
question time — never from memory.

---

## Surfaces

Three new routes in `apps/web`, all reads over the work tables and ledger — no new stores:

| Surface     | Query                                                                     |
| ----------- | -------------------------------------------------------------------------- |
| **My Work** | work items at any depth where `dri = me`, plus open offers naming me. Breadcrumb and dates on cards. |
| **All Work**| root items grouped with their subtree, DRI or *open*, review/due dates. Any item opens its own page with its children. |
| **Org**     | latest confirmed L3 brief, established date, founder, Shapers, members, DRIs. |

Offer, accept, decline, done are the same mutations everywhere — a card is another door onto
the same log as chat.

---

## Feature → design map

| Feature                        | Reads                    | Writes                        |
| ------------------------------ | ------------------------ | ----------------------------- |
| 1. Direction stays current     | L3                       | L3 (Shaper confirm)           |
| 2. The org listens             | —                        | L1 (automatic)                |
| 3. Talk becomes work           | L1 window + L3 + L4      | work-item drafts (root or under the nearest held item) |
| 4. Offered, never assigned     | work tables              | accept/decline + L2           |
| 5. Talk moves work             | L1                       | done draft → DRI confirm / silent window + L2 (+ receipt) |
| 6. Homes (My/All Work, Org)    | work tables + L2 + L3    | —                             |
| 7. Money via proposals         | project + L2 trail       | draft proposal (existing system) |
| 8. Reviews write themselves    | L2 + L4 for the project  | review summary draft          |
| 9. Ask the org anything        | L3 + L2 aggregates + L1 search | —                       |
| 10. Newcomers                  | profile + open work + L3 | profile (person confirms)     |

---

## Build order

1. **L2 ledger + `work_items` tree + mutations with role checks.** The spine. No AI yet —
   cards can be created from an agent later; the objects, the promotion rule, and the cascade
   rules come first.
2. **Surfaces.** My Work, All Work, Org. Visible progress, forces the queries to be right.
3. **Shapers chat → L3 write path.** Standing room, draft-and-confirm brief. (L3 storage
   exists; this adds the conversational write path.)
4. **L1 ingestion.** The Matrix appservice/bot, backfill, and transcript ingest — its own
   project (see the L1 section), and the long pole for everything after it. Can start in
   parallel with 1–3.
5. **The agent, pass by pass.** Hear (on the ingestion from step 4) → pre-filter → Think
   (drafts only, measured precision) → Route. Tune pickiness on a real space before widening.
6. **Done-from-talk.** As done drafts with confirm or a silent window. Needs trust in
   transcripts and receipts; last for a reason.
7. **L4 + reviews.** Once decisions flow, record outcomes and assemble reviews.

Each step ships value without the ones after it.

---

## Known risks

Ranked, with where each is addressed:

1. **L1 ingestion is the long pole.** Chat bodies live on Matrix, not in Postgres; no
   appservice exists today. The most novel infrastructure here, and half the features sit on
   it. (L1 section, build step 4.)
2. **Two event streams.** The new ledger vs. the existing `events` table must be reconciled
   before the first migration, and ledger writes enforced through one shared path. (L2
   section.)
3. **Model-as-trigger cost and auditability.** Without the deterministic pre-filter, THINK
   contradicts the memory architecture's own anti-pattern and its cost is unbounded. (Agent
   section.)
4. **Silent AI state changes.** Done-from-talk must stay propose-then-confirm; transcript
   attribution errors are exactly where publish-then-review would hurt. (Agent section.)
5. **Flag ↔ room drift.** The Shaper flag and Shapers-room membership are two systems; the
   reconcile loop needs an owner. (Work objects section.)
6. **Depth without discipline.** A recursive tree lets work fragment into trees nobody can
   read. The cascade rule (done bubbles up, never down) holds the one invariant that matters;
   keeping money off the tree removes the other. The boards hold the readability — All Work shows
   roots and one level, everything deeper is behind the item's own page. Watch median depth on
   a real space; if it passes three, the product has a problem the schema cannot fix. (Work
   objects section.)

---

## What we do not build

- No fine-tuning, no knowledge graph, no autonomous memory writes.
- No AI-initiated payments — money moves only through the existing proposal system.
- No assignment. There is no code path that puts work on a person without their accept.

---

## Related

- [The Intelligent Organization — What it is](../product/intelligent-org-features.md) — the target
- [The Intelligent Organization — Current State](./intelligent-org-current-state.md) — what is shipped vs designed
- [Organizational Intelligence — Memory Architecture](./organizational-intelligence.md) — the four layers
