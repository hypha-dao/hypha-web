---
title: "Space Memory panel — implementation plan"
date: 2026-04-12
status: draft
tags: [coherence, space-memory, org-memory, matrix, proposals, ui]
parent: docs/index.md
---

# Space Memory panel — implementation plan

> **Goal:** Add a **Space Memory** section on the Coherence tab, **directly under** the Signals panel, listing space-scoped **assets** (documents, images, etc.) with **human-readable upload context**.  
> **Architecture context:** [documents-and-media-overview.md §4](../architecture/documents-and-media-overview.md#4-organisation-memory--how-all-documents-matrix--upload-can-work) (organisation memory: one catalogue, Matrix vs upload backends). Chat attachments on `main`: [space-chat-attachments.md](../architecture/space-chat-attachments.md), [space-chat-attachments (dev)](../development/space-chat-attachments.md).  
> **Upstream:** Matrix chat attachments + media architecture merged in [#2133](https://github.com/hypha-dao/hypha-web/pull/2133) (on `main`). This document and coherence cross-links ship via [#2138](https://github.com/hypha-dao/hypha-web/pull/2138).

---

## 0. Current codebase snapshot (`main`, reviewed 2026-04-12)

Use this as the **source of truth** when implementing; re-verify paths after large refactors.

| Area | Location on `main` |
|------|---------------------|
| Coherence tab shell | `packages/epics/src/coherence/components/coherence-block.tsx` — today renders **only** `SignalSection` inside `isAuthenticated`; otherwise `Empty` + `CoherenceTab.signInToSee` |
| Signals UI | `packages/epics/src/coherence/components/signal-section.tsx` |
| Space documents API | `GET /api/v1/spaces/[spaceSlug]/documents/all` → `apps/web/src/app/api/v1/spaces/[spaceSlug]/documents/all/route.ts` (`findAllDocumentsBySpaceSlugWithoutPagination`, `checkSpaceAccess`) |
| Document shape | `packages/core/src/governance/types.ts` (`Document`, `Attachment`); storage: `packages/storage-postgres/src/schema/document.ts` (`attachments` jsonb, `lead_image`) |
| Matrix send + attachments | `packages/core/src/matrix/client/providers/matrix-provider.tsx` — `sendMessage` with optional `attachments`; `uploadContent` with `{ name, type }`; partial failure: `SendMessagePartialFailureError` |
| Timeline → UI model | `packages/core/src/matrix/rich-reply.ts` — `m.file` / `m.image` → shared `Message` type |
| Chat composer / bubbles | `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx`, `packages/epics/src/common/human-right-panel.tsx`, `human-chat-panel-message-bubble.tsx` |
| Matrix SDK version | `matrix-js-sdk@^40` in `packages/core` (per Hypha Matrix role: not ^41 in Next.js) |

---

## 1. Problem statement

Organisations need **one place** to see files relevant to a space, whether they originated from **proposal / agreement uploads** (HTTPS URLs on `documents`) or **Matrix chat** (`mxc://` on the homeserver). Those bytes **do not** live in the same store; the UI must not conflate them. Long term, **org memory** is a catalogue + ingestion paths (§4). This document specifies the **Space Memory panel** product slice and phased delivery.

---

## 2. Scope phases

| Phase | Scope | New DB / tables |
|-------|--------|-----------------|
| **V1** | List assets **derivable from existing** Hypha `documents` rows: `attachments` (JSONB) + `lead_image`. Same auth as existing space documents API. | **None** |
| **V2** | **Org catalogue** (§4): register rows on proposal save + Matrix ingestion worker; panel reads **one** catalogue API. | **Yes** (catalogue + migrations) when product requires unified list, RAG, or reliable chat file listing |
| **V1b (optional)** | Merge **Matrix** `m.file` / `m.image` from client timeline (space or signal `roomId`) **without** catalogue. | **None**, but **not recommended** for production parity (partial history, sync, redaction, performance) |

**Transcripts:** If “transcript” means **chat text**, it is **not** a file row on `documents` in V1 — treat as **follow-up** (separate indexing / catalogue text refs). If stored as **uploaded files** on documents, they appear like any other attachment.

---

## 3. Placement and UX (UI/UX)

- **Route:** Coherence tab — `packages/epics/src/coherence/components/coherence-block.tsx`.
- **Order:** Render **below** `SignalSection`, **above** the DHO layout’s “Spaces you might like” (layout is outside tab `children`; panel sits in tab column only).
- **Auth:** Match **`CoherenceBlock` on `main`**: the entire authenticated block (Signals today; Signals + Space Memory after implementation) sits inside `isAuthenticated`; unauthenticated users see **only** the existing `Empty` + `signInToSee` copy — **do not** fetch documents for signed-out users.
- **Chrome:** Match Signals rhythm: section title **“Space Memory”**, optional search, `Separator` from `@hypha-platform/ui`, spacing consistent with `CoherenceBlock` (`gap-6`, `py-4`).
- **Row content:** Primary = file name (truncated + `title` full string); secondary = **context line** (e.g. proposal title + state); meta = date; action = open in new tab (`rel="noopener noreferrer"`) where allowed.
- **States:** loading (skeleton or compact spinner), empty, error + retry, filtered-empty if search exists.
- **Tokens:** Hypha design system only (`text-foreground`, `text-muted-foreground`, `border-border`, `bg-accent-9` for primary actions) — see `.agents/roles/senior-ui-ux-design-engineer.base.md` and `packages/ui-utils`.
- **Accessibility:** `section` + `aria-labelledby`; list semantics (`role="list"` / `listitem`); keyboard-focusable row or explicit link with visible focus ring.

---

## 4. Data contract (fullstack)

### 4.1 `SpaceMemoryItem` (UI-facing)

```typescript
type SpaceMemorySource = 'proposal_upload' | 'matrix_chat' | 'unknown';

type SpaceMemoryAssetKind = 'document' | 'image' | 'other';

interface SpaceMemoryItem {
  /** Stable id, e.g. `${documentId}:attachment:${index}` or `${documentId}:lead` */
  id: string;
  name: string;
  url: string;
  kind: SpaceMemoryAssetKind;
  source: SpaceMemorySource;
  uploadedAt: string; // ISO 8601 — prefer document updatedAt (fallback createdAt) for “last associated change”
  context: {
    /** Single line for the list row */
    label: string;
    documentId?: number;
    documentSlug?: string;
    documentState?: string;
    matrixRoomId?: string;
    matrixEventId?: string;
  };
}
```

### 4.2 V1 builder (pure function)

- **Input:** `Document[]` (or equivalent type from `@hypha-platform/core` governance) for the space, including `attachments`, `leadImage`, `title`, `slug`, `state`, `id`, `label`, timestamps.
- **Output:** `SpaceMemoryItem[]`, sorted by `uploadedAt` descending (default).
- **Rules:**
  - Emit one item per `attachments[]` entry (string URL or `{ name, url }`).
  - If `leadImage` is non-empty and **not** already represented by an attachment URL, emit one item with `kind: 'image'` (or infer from extension) and a distinct `id` suffix `:lead`.
  - `source: 'proposal_upload'` for all V1 rows.
  - `context.label`: include document title and state (and optional `label` field) — exact copy pattern = i18n with interpolation.
- **Kind inference:** map from filename / mime if available; default `other` for unknown extensions.

**Location:** `packages/core` (e.g. `governance` or `coherence/lib/build-space-memory-items.ts`) — **unit tested** (empty, only lead, duplicate URL edge case).

### 4.3 V1 API consumption

- Reuse **`GET /api/v1/spaces/[spaceSlug]/documents/all`** (`findAllDocumentsBySpaceSlugWithoutPagination` + `checkSpaceAccess`) — no new route required for V1.
- Client: SWR or existing fetch pattern used elsewhere for space-scoped data; **credentials** as required by API.

### 4.4 Matrix (V2 / optional V1b)

- **Matrix JS SDK:** listen on the relevant `Room` timeline (space room and/or signal `roomId` from `Coherence`). Filter `EventType.RoomMessage` (or equivalent) where `msgtype` is **`m.file`** or **`m.image`**. Read `content.url` (`mxc://`), `body`, `filename`, `info`, sender, `event.getId()`, room id, `event.getTs()`.
- **Display URLs:** client UI uses `mxcUrlToHttp` with the same rules as chat bubbles (see dev guide — often **unauthenticated** media endpoints for `<img>` / links).
- **Do not** use room **aliases** as stable IDs for `sendEvent` / server APIs; use real `!room_id:server` per Hypha Matrix role rules.
- **Partial sends:** chat already surfaces `SendMessagePartialFailureError` when some attachments commit and others fail; any V1b client reader should tolerate **gaps** in local echo vs server timeline.
- **V2:** server job registers catalogue rows (`source = matrix_chat`); panel reads catalogue only (§4.2).

---

## 5. Implementation checklist

| Step | Deliverable | Verification |
|------|-------------|--------------|
| 1 | `buildSpaceMemoryItemsFromDocuments` + unit tests | `pnpm nx run @hypha-platform/core:test` — prefer a **dedicated test file** that imports only governance/pure code so it is not coupled to Matrix Vitest graph issues |
| 2 | `useSpaceMemory` (or inline hook) fetching `documents/all` + mapping | Manual: network tab, correct `spaceSlug`; align with other hooks using **`useSWR`** in `packages/core` (see `useSpaceBySlugExists`, `useOrganisationSpacesBySingleSlug`, etc.) |
| 3 | `SpaceMemorySection` in `packages/epics/src/coherence/components/` | Story / manual Coherence tab |
| 4 | Wire `CoherenceBlock` below `SignalSection` | Coherence tab shows both sections |
| 5 | i18n keys (`CoherenceTab` or agreed namespace): title, empty, error, retry, context pattern, optional search | `packages/i18n/src/messages/*.json` (en, de, es, fr, pt) |
| 6 | E2E: `apps/web-e2e` — section present when auth + coherence; empty or fixture | `pnpm nx run web-e2e:e2e` (e.g. `--spec=coherence.spec.ts`); extend `apps/web-e2e/src/pages/coherence.page.ts` if needed |
| 7 | (V2) Catalogue schema, register on document save, Matrix ingestion, `GET .../space-memory` | Separate milestone per §4.5 in architecture doc |

---

## 6. Product acceptance (V1)

| ID | Criterion |
|----|-----------|
| SM-1 | Space Memory appears **under** Signals on `/[lang]/dho/[slug]/coherence` for authenticated users. |
| SM-2 | Each row shows **name**, **context** (proposal-linked copy), **date**, **open** action for HTTPS assets from documents. |
| SM-3 | Empty state when no attachments / lead image across space documents. |
| SM-4 | Loading and error states with retry. |
| SM-5 | Optional: client-side search over name + document title. |
| SM-6 | No regression to Signal section behaviour or tab gating. |

---

## 7. Security and compliance

- **Reuse** `checkSpaceAccess` behaviour of the documents-all API — do not expose asset URLs to non-members.
- **URLs:** treat as untrusted for inline execution; **open** as download / new tab; do not `eval` or inject HTML from filenames.
- **Matrix media (V2):** follow homeserver token / media URL policy documented in development space-chat guide.

---

## 8. References

| Doc | Purpose |
|-----|---------|
| [documents-and-media-overview.md §4](../architecture/documents-and-media-overview.md) | Org memory catalogue and ingestion order |
| [space-chat-attachments.md](../architecture/space-chat-attachments.md) | Matrix attachment UX and event shape on `main` |
| [space-chat-attachments (dev)](../development/space-chat-attachments.md) | `sendMessage`, `Message`, composer/bubble behaviour |
| [coherence-research.md](./coherence-research.md) §1.1 | Coherence vs Matrix rooms vs org memory |
| [coherence-incremental-plan.md](./coherence-incremental-plan.md) | Post-cleanup Space Memory item |

---

_Outcome:_ V1 ships a **catalogue-shaped** panel backed **only** by existing document storage; V2 aligns the same UI with the **org memory catalogue** once schema and ingestion exist.
