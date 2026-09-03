---
title: 'The Intelligent Organization — Current State'
date: 2026-08-29
status: draft
tags: [architecture, intelligent-org, ai, memory, hypha]
---

# The Intelligent Organization — Current State

What intelligence is actually built on Hypha today, and how AI is used. Companion to
[What it is](../product/intelligent-org-features.md) (the target) and
[Design](./intelligent-org-design.md) (how to get there).

Snapshot of the `hypha-web` codebase as of 2026-08-29. Not a roadmap.

---

## One sentence

Hypha has a capable **in-app copilot** — onboarding, proposal drafting, space Q&A, navigation —
plus a **file/timeline catalogue** called Space Memory. It does **not** yet run the intelligent-org
loop: hear → remember → offer work → watch outcomes → revise beliefs.

---

## How AI is used

Stack: **Vercel AI SDK + OpenRouter** (default `openai/gpt-4o-mini`). Contract everywhere: **the
AI drafts, the member confirms.**

The system prompt’s north star is *THE AI DOES IT FOR ME* — propose, pre-fill, navigate; the
member reacts yes / tweak / no.

| Surface | What it does | Flag (default) |
| ------- | ------------ | -------------- |
| **Left AI panel** on space pages | Ongoing advisor: reads space data, drafts proposals, creates signals, opens the right screen | `enable-ai-chat` (on) |
| **Onboarding hero** | Conversational space creation — purpose, governance, visuals, nested spaces. Optional Live Voice (OpenAI Realtime) | `enable-onboarding-ai-hero` (on), `enable-onboarding-write-tools` (on), `enable-onboarding-voice-realtime` (off) |
| **MCP server** (`packages/mcp-server`) | Same tools for Cursor / external agents | always, stdio |

A model actually runs in those three places. Almost everything else that looks “smart” is
arithmetic, heuristics, or a template.

---

## What is shipped

### Space advisor chat

`packages/chat-server` — tools the model can call in a live space.

**Read:** space, members, documents/proposals, treasury holdings, signals, parent/child ecosystem
graph, org-memory catalogue, individual memory assets (text, PDF extract, images), web search.

**Write / act:** draft and pre-fill any on-chain governance proposal (one field at a time, then
open the form); create a Coherence signal; post to Human Chat as the member; summarize recent
Matrix discussion; ingest a call recording/transcript into Space Memory; navigate to the relevant
screen (`mcp_navigation`).

This is the main intelligence members feel: ask about the space, get a grounded answer, have a
proposal or signal drafted.

### Space Memory — L1 substrate

Closest thing to organizational memory that is **on this branch**. Coherence tab
(`enable-space-memory`, on). Aggregates:

- proposal uploads
- Matrix chat files/images
- call recordings and transcripts
- discussion summaries

The AI lists this via `get_org_memory_by_space_slug` and can fetch a file’s content. That is
**raw substrate** — chat, files, transcripts — not curated beliefs.

Discussion summaries are **not** model-written. They take the last few messages and truncate.

### Coherence signals — proactive, mostly not a model

A cron **signal orchestrator** watches memory ingest (new transcript, summary, upload) and may
emit a signal. Scoring is **arithmetic** — asset counts, title overlap, cooldowns, daily caps.
Copy is templated (*“Recent space-memory activity indicates a coordination opportunity.”*).

The AI *can* also create a signal from chat (`create_space_signal_by_slug`) and relay one to a
connected space. That path is model-driven.

### Onboarding AI

Conversational wizard: interviews for purpose and principles; infers voting / entry /
transparency; looks at other Hypha ecosystems and proposes a nested-space blueprint; generates
logo/banner images; creates the space on-chain after confirmation. Optionally continues in Live
Voice.

### MCP for external agents

Same catalogue as in-app chat: org memory, documents, people, treasury, signals, proposal
guidance, discussion summary, call ingest. Cursor or an IBA can use Hypha as context.

---

## Built, not on this branch

**Space Intelligence** (L3 beliefs) lives on `feat/org-memory` /
[PR #2461](https://github.com/hypha-dao/hypha-web/pull/2461):

- versioned Markdown artifacts in object storage (purpose, assessments, insights, …)
- human-approved publish (propose → member confirm)
- graph / sunburst of artifacts ↔ signals
- Hypha Energy starter pack
- IBA API-key write path

Until it merges, the AI has no always-loaded “what this org believes” corpus — only live queries
of Postgres / Matrix.

---

## Designed, not built

From [What it is](../product/intelligent-org-features.md) and
[Design](./intelligent-org-design.md):

| Layer / feature | Status |
| --------------- | ------ |
| **L1 substrate** | Partial: files, transcripts, and summaries ship as Space Memory. Chat message bodies stay on Matrix — no ingestion into Postgres (the design's long pole). |
| **L2 activity ledger** | `events` table exists and is barely used. Not the typed ledger. |
| **L3 beliefs** (org brief, objectives) | Built on `feat/org-memory`, not merged. No Shapers chat write path. |
| **L4 decision memory** | Does not exist |
| Work items tree (projects / tickets, any depth) / DRI / offer–accept | Do not exist |
| Hear → Think → Route agent | Does not exist. Chat is pull (member asks), not a listener on rooms. |
| My Work / All Work / Org homes | Do not exist |
| Reviews that write themselves | Do not exist |
| “Ask the org anything” with receipts | Partial: chat can query memory, no L3+L4 grounding or citation contract |

Scorecard from [Organizational Intelligence — Memory Architecture](./organizational-intelligence.md):

> L1 exists. L3 is built and awaiting merge. L2 exists as an unused table. **L4 does not exist.**

The signal orchestrator is the failure mode that document names: both “did something change?” and
“what does it mean?” done with arithmetic, so the output stays generic.

---

## Related

- [The Intelligent Organization — What it is](../product/intelligent-org-features.md) — the target
- [The Intelligent Organization — Design](./intelligent-org-design.md) — how to build it
- [Organizational Intelligence — Memory Architecture](./organizational-intelligence.md) — the four layers
- [Space Memory panel](../plans/space-memory-panel.md) — current L1 aggregation surface
- Space Intelligence spec — L3 as built on `feat/org-memory`; [PR #2461](https://github.com/hypha-dao/hypha-web/pull/2461)
