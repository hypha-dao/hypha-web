---
title: "Documentation Hub"
date: 2026-03-29
status: final
tags: [index, documentation]
---

# Documentation Hub

Central index for all project documentation.

---

## Architecture

Cross-cutting technical references (storage, Matrix, org-wide document memory).

| Document | Description |
|---|---|
| [Documents and media overview](./architecture/documents-and-media-overview.md) | Where chat vs proposal bytes live; **§4 organisation memory** (single catalogue, Matrix + upload ingestion) |
| [Space chat attachments](./architecture/space-chat-attachments.md) | Matrix `m.file` / `m.image` behaviour in Human Chat; links to §4 for org memory |
| [Space chat attachments (developer)](./development/space-chat-attachments.md) | APIs and UI wiring for chat attachments |

**Pull request:** [feat(chat): Matrix attachments + space chat documentation #2133](https://github.com/hypha-dao/hypha-web/pull/2133) — PR body summarises the two storage paths and points reviewers at **§4**.

---

## Plans

Active implementation plans and feature roadmaps.

| Document | Description | Status |
|---|---|---|
| [Coherence Research](./plans/coherence-research.md) | Reference implementation analysis for the coherence screen feature | final |
| [Coherence Incremental Plan](./plans/coherence-incremental-plan.md) | Step-by-step implementation plan (storage → core → epics → routes → nav) | final |
| [Coherence Chat Panel Research](./plans/coherence-chat-panel-research.md) | Architecture research for integrating coherence chat into the Human Right Panel | final |
| [Coherence Chat Panel Plan](./plans/coherence-chat-panel-plan.md) | Step-by-step plan to open coherence chats in the right panel sidebar (6 steps) | draft |
| [Space Memory panel](./plans/space-memory-panel.md) | Coherence tab: assets list + context; V1 from documents; V2 org catalogue (§4) | draft |

## Requirements

Feature requirements and specifications are in [docs/requirements/](./requirements/).
