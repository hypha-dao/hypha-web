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

**L1 — substrate.** Already mostly exists: Matrix room events (coherence chat), uploaded
documents, and — new — **call transcripts** posted back into the room after a huddle. One
ingestion path: every new L1 event lands in Postgres (searchable, FTS) with a stable id the
other layers can point at.

**L2 — activity ledger.** A Drizzle table (`activity_ledger`): `(space_id, actor, verb,
object_type, object_id, evidence_event_id, created_at)`. The events table already sketched in
the memory architecture — this design makes it real. Every work-object state change writes a
row. Reviews and receipts are queries over this table.

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

Two new tables in `storage-postgres`, following the existing schema conventions:

**`projects`** (the mandate): `space_id`, `title`, `brief`, `dri_person_id?`, `budget_indication`,
`review_at`, `state` (`draft → offered → active → in_review → closed`), `created_from_event_id`.

**`tickets`**: `project_id`, `title`, `dri_person_id?`, `due_at`, `state`
(`draft → offered → accepted → done | declined`), `created_from_event_id`,
`done_evidence_event_id?`.

Rules enforced in mutations, not in the UI:

- Only a **Shaper** promotes a project draft (and sets budget indication + review date).
- Only the **project DRI** promotes a ticket draft (and sets estimated completion).
- Only the **named person** accepts or declines an offer.
- Every state change writes an L2 row with the evidence pointer.

Shapers are a space role on the existing membership model (like today's member/admin flags —
one new flag, no parallel roster). The Shapers chat is a private coherence room; its membership
mirrors the flag.

Money stays out: `budget_indication` is a number on the project. Payment happens later through
the existing proposal/treasury system; the agent may draft that proposal referencing the
project and its ledger trail, and it goes through governance like any other proposal.

---

## The org agent

Not a chatbot. A pipeline with three passes, running server-side (extend `chat-server` or a
worker beside it — same OpenRouter/AI SDK stack):

```
1. HEAR    new L1 events (Matrix webhook / transcript ingest)
              ↓ batched per room, debounced
2. THINK   agent call: latest L3 (always) + recent room context (L1 window)
           + open work for this space (L2/projects/tickets) + relevant L4
              ↓ outputs structured drafts, or nothing
3. ROUTE   draft → the one person who can make it real
           (Shaper for projects, project DRI for tickets, named DRI for done)
```

Pass 2 is deliberately picky: most messages produce nothing. A draft carries `needs:
shaper` or `needs: dri:<person>` — routing is data, and only that person's confirm mutation
promotes it. Duplicate detection: before creating a draft, check open drafts for the same gap
(embedding similarity is fine *here* — it's deduplication, not truth).

Confirm is an ordinary server mutation with the role check, called from a card in the UI or a
reply in chat. Notifications ride the existing OneSignal path.

"Ask the org anything" (feature 9) is the same context recipe in reverse: answer from L3 +
live L2 aggregates, search L1 for receipts, cite event ids. Live numbers (treasury) fetched at
question time — never from memory.

---

## Surfaces

Three new routes in `apps/web`, all reads over the work tables and ledger — no new stores:

| Surface     | Query                                                                     |
| ----------- | -------------------------------------------------------------------------- |
| **My Work** | projects + tickets where `dri = me`, plus open offers naming me. Dates on cards. |
| **All Work**| all projects grouped with their tickets, DRI or *open*, review/due dates.  |
| **Org**     | latest confirmed L3 brief, established date, founder, Shapers, members, DRIs. |

Offer, accept, decline, done are the same mutations everywhere — a card is another door onto
the same log as chat.

---

## Feature → design map

| Feature                        | Reads                    | Writes                        |
| ------------------------------ | ------------------------ | ----------------------------- |
| 1. Direction stays current     | L3                       | L3 (Shaper confirm)           |
| 2. The org listens             | —                        | L1 (automatic)                |
| 3. Talk becomes work           | L1 window + L3 + L4      | project/ticket drafts         |
| 4. Offered, never assigned     | work tables              | accept/decline + L2           |
| 5. Talk moves work             | L1                       | ticket state + L2 (+ receipt) |
| 6. Homes (My/All Work, Org)    | work tables + L2 + L3    | —                             |
| 7. Money via proposals         | project + L2 trail       | draft proposal (existing system) |
| 8. Reviews write themselves    | L2 + L4 for the project  | review summary draft          |
| 9. Ask the org anything        | L3 + L2 aggregates + L1 search | —                       |
| 10. Newcomers                  | profile + open work + L3 | profile (person confirms)     |

---

## Build order

1. **L2 ledger + work tables + mutations with role checks.** The spine. No AI yet — cards can
   be created from an agent later; the objects and rules come first.
2. **Surfaces.** My Work, All Work, Org. Visible progress, forces the queries to be right.
3. **Shapers chat → L3 write path.** Standing room, draft-and-confirm brief. (L3 storage
   exists; this adds the conversational write path.)
4. **The agent, pass by pass.** Hear (ingest + transcripts) → Think (drafts only, measured
   precision) → Route. Tune pickiness on a real space before widening.
5. **Done-from-talk.** Needs trust in transcripts and receipts; last for a reason.
6. **L4 + reviews.** Once decisions flow, record outcomes and assemble reviews.

Each step ships value without the ones after it.

---

## What we do not build

- No fine-tuning, no knowledge graph, no autonomous memory writes.
- No AI-initiated payments — money moves only through the existing proposal system.
- No assignment. There is no code path that puts work on a person without their accept.
