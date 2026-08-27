---
title: 'Documentation Hub'
date: 2026-03-29
status: final
tags: [index, documentation]
---

# Documentation Hub

Central index for all project documentation.

---

## Start here — Intelligent Organization

The product intent and the memory architecture that serves it. Read these two together.

| Document                                                                                           | Description                                                                                   | Status |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| [Intelligent Org — Exploration](./product/intelligent-org-exploration.md)                          | What intelligent means, Shaper / DRI loop, Buzz vs Hypha and which route to take              | draft  |
| [Intelligent Org — Buzz additions](./product/intelligent-org-buzz-additions.md)                    | Buzz fork: Shapers chat, talk→work, My Work / All Work / Org, talk moves tickets               | draft  |
| [The Intelligent Organization](./product/intelligent-org.md)                                       | Short brief: what it is, Shaper and DRI, mandate / ticket, payments, screens                  | draft  |
| [Intelligent Organization — Screens](./product/intelligent-org-screens.md)                         | Each UI screen: what it is for and what happens there                                         | draft  |
| [User Journeys](./product/user-journeys.md)                                                        | Target-state journeys: roles, decisions, funding — how we intend people to use Hypha          | draft  |
| [User Journeys — UI and flows](./product/user-journeys-ux.md)                                      | Screen-by-screen flows: join, become steward or contributor, and the three homes              | draft  |
| [User Journeys — DRI](./product/user-journeys-dri.md)                                              | Simple model: member, DRI, Shaper — one pot per mandate with standing / ticket / expense pay  | draft  |
| [Organizational Intelligence — Memory Architecture](./architecture/organizational-intelligence.md) | How memory is maintained and retrieved, how large it can get, how the AI determines relevance | draft  |

## Plans

Active implementation plans and feature roadmaps.

| Document                                                                  | Description                                                                     | Status |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| [Coherence Research](./plans/coherence-research.md)                       | Reference implementation analysis for the coherence screen feature              | final  |
| [Coherence Incremental Plan](./plans/coherence-incremental-plan.md)       | Step-by-step implementation plan (storage → core → epics → routes → nav)        | final  |
| [Coherence Chat Panel Research](./plans/coherence-chat-panel-research.md) | Architecture research for integrating coherence chat into the Human Right Panel | final  |
| [Coherence Chat Panel Plan](./plans/coherence-chat-panel-plan.md)         | Step-by-step plan to open coherence chats in the right panel sidebar (6 steps)  | draft  |

## Requirements

Feature requirements and specifications are in [docs/requirements/](./requirements/).

| Document                                                                                                   | Description                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [MCP `get_documents_by_space_slug`](./requirements/mcp-get-documents-by-space-slug-tech-spec.md)           | MCP read tool for space documents (DB + access parity); **§8** org memory roadmap (upload URLs today; Matrix via catalogue) |
| [Chat AI `get_documents_by_space_slug`](./requirements/chat-ai-get-documents-by-space-slug-integration.md) | Hypha AI / chat-server integration; prompt + fetch guidance for **attachments** / org memory alignment                      |
| [Documents and media overview](./architecture/documents-and-media-overview.md)                             | **§4** org memory + **§4.7** MCP / Chat AI                                                                                  |
| [Space Memory panel](./plans/space-memory-panel.md)                                                        | Coherence UI plan; **§9** MCP / Chat                                                                                        |
