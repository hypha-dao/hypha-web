# Documents and media — plain overview

Hypha handles **files and images** in two main places. The **bytes** and **metadata** live in different systems depending on whether you are in **space chat** or **proposals (agreements)**.

---

## 1. Space human chat (Matrix)

**What it is:** Attachments you send from the Human Chat panel in a Space (or coherence conversation).

**Where the files live:** On your **Matrix homeserver**, in its **content repository** (the same place Matrix stores any uploaded media). After upload, the app only keeps a pointer: an **`mxc://…`** URI inside a chat event — not a second copy in Hypha’s own database for that message.

**How it is managed (simple flow):**

1. You pick a file (paperclip) or image (gallery) in the composer.
2. The UI **stages** drafts locally (small previews use temporary browser URLs).
3. When you hit **Send**, the client **uploads** each file to the homeserver, then sends one or more **`m.room.message`** events (`m.file` or `m.image`) that reference the uploaded media.
4. Optional text is sent as a normal text message after the attachments.
5. Everyone sees the thread in **Matrix**; the UI turns `mxc://` into normal **HTTPS** links for thumbnails and “open in new tab,” using the standard Matrix media paths.

**In one sentence:** Chat attachments are **Matrix-native media**: stored on the homeserver, ordered and described by **room events** you can sync like any other message.

*More detail:* [space-chat-attachments.md](./space-chat-attachments.md) and [space-chat-attachments (dev)](../development/space-chat-attachments.md).

---

## 2. Proposals / agreements (Hypha app)

**What it is:** Documents and screenshots you attach when **creating or viewing a proposal** (agreement flow).

**Where the files live:** In your **file / CDN pipeline** (e.g. hosted URLs returned after upload). The **proposal record** in Hypha stores **links and filenames** (`name` + `url`, or similar), not Matrix `mxc` URIs. That is separate from Matrix chat.

**How it is managed:**

1. Upload runs through the **agreement / proposal** upload path you already use.
2. The UI lists attachments with names and icons; opening a file uses the **stored URL**.
3. **Proposal detail** and **create** screens share the same idea: show the right **icon** from the **filename** (and thumbnail for images when the URL allows it).

**In one sentence:** Proposal attachments are **app documents**: stored where your upload service puts them, with **metadata in Hypha** so lists and detail views can show them.

---

## 3. Side‑by‑side

| | **Space chat** | **Proposals** |
|--|----------------|---------------|
| **Primary store** | Matrix homeserver (content repo) | Your upload / CDN + Hypha DB fields |
| **Pointer in app** | `mxc://` in `m.room.message` events | HTTPS URLs (+ names) on the document |
| **Who “owns” the file** | The room’s homeserver | Hypha + file host |
| **Organisation memory** | See **§4** below (ingestion from Matrix events) | See **§4** below (ingestion from document / upload records) |

---

## 4. Organisation memory — how **all** documents (Matrix + upload) can work

The spec asks that the **space** (organisation) can use **org memory** over **every** document: both **Matrix chat attachments** and **proposal / upload** files. Today those bytes sit in **two different stores**; org memory does not need to move them into a third silo on day one, but it **does** need a **single catalogue** in Hypha that knows *what exists*, *where it lives*, *who may see it*, and *how to retrieve text for RAG*.

### 4.1 Core idea: one catalogue, two (or three) backends

Introduce (or extend) an **organisation-scoped asset / document index** row for each logical file, for example:

| Field (conceptual) | Purpose |
|--------------------|--------|
| `organisation_id` / `space_id` | Scope for ACL and “everything in this space” |
| `source` | `matrix_chat` \| `proposal_upload` \| … |
| `matrix_room_id`, `matrix_event_id` | When source is Matrix (optional if not Matrix) |
| `mxc_uri` | Matrix pointer when applicable |
| `app_url` or `storage_key` | When source is upload / CDN |
| `mime`, `size`, `filename`, `sha256` (optional) | Dedup, display, policy |
| `indexed_text_ref` / `embedding_ref` | Pointer to chunks in your vector / search store |
| `visibility` / `retention` | Policy |

**Retrieval for the model:** the worker that answers org-memory questions loads rows for the space, then **fetches bytes or text** using the right backend (Matrix authenticated download vs signed HTTPS URL vs internal object store).

### 4.2 Ingestion path A — Matrix chat (`m.file` / `m.image`)

After (or when) a successful `m.room.message` with an attachment is known:

1. **Event hook** — A server-side listener or periodic job reads the space room timeline (or consumes your existing sync/outbox if you centralise Matrix server-side).
2. **Normalise** — For each `m.file` / `m.image`, read `url` (`mxc://`), `body`, `filename`, `info`, sender, `event_id`, room id, timestamp.
3. **Register** — Upsert a catalogue row (`source = matrix_chat`, `mxc_uri`, …) keyed by `(room_id, event_id)` or stable content id.
4. **Index** — Optionally **download** via homeserver (with service token) into a **private** org bucket for long-term RAG and offline policy **or** index from `mxc` + metadata only until mirroring exists.
5. **ACL** — Row inherits space membership (and any stricter org rules).

### 4.3 Ingestion path B — Proposals / uploads (existing pipeline)

When a proposal (or other entity) is saved with attachments:

1. **Webhook or same transaction** — After upload returns URL, the API that persists the document **also emits** “asset registered” for org memory (or a queue message).
2. **Normalise** — `source = proposal_upload`, `document_id`, `attachment_index`, `app_url`, filename, mime from upload metadata.
3. **Register + index** — Same catalogue + indexer as above; fetch bytes from CDN / object store with server credentials.

### 4.4 Why this satisfies “space has access in org memory”

- **Access** = catalogue rows are **scoped to the organisation / space** and filtered by the same auth you use elsewhere.
- **All documents** = every attachment becomes **one row** (Matrix-backed or upload-backed); the memory layer **does not care** which backend holds bytes once it has a pointer and a fetch strategy.
- **No double truth for chat** — Matrix remains the **chat** source of truth; org memory is an **index + optional mirror** for search and AI, not a replacement for the timeline.

### 4.5 Order of implementation (typical)

1. **Catalogue schema + API** (register, list by space, delete on redaction if required).  
2. **Proposal path first** (you already have URLs in DB).  
3. **Matrix path** (subscribe to room / backfill events for spaces you care about).  
4. **Embeddings / chunking** on top of registered assets.  
5. **Optional:** copy Matrix media into org-owned storage for retention and E2EE‑safe patterns.

### 4.6 Edge cases to decide in product

- **Redaction / delete** — Remove or tombstone catalogue rows when Matrix events are redacted or proposals delete attachments.  
- **E2EE rooms** — May require **client-assisted** registration or encrypted export; spec should call out if org memory must include E2EE attachments.  
- **Deduplication** — Same file re-uploaded in chat vs proposal: optional `sha256` match to link rows.

---

## 5. Security and limits (short)

- **Chat:** Matrix token is used for **upload** and for the **client**; media links for **inline display** use the normal unauthenticated media URL pattern so browsers can load images without sending a Bearer header on every `<img>`.
- **Size and types** are limited by the homeserver (chat) and by your **proposal validation** (agreements).
- **Encrypted Matrix rooms** would need a different attachment story; today’s chat path assumes **unencrypted** rooms.

---

## 6. Where to look in the repo

| Area | Main locations |
|------|----------------|
| Matrix send + upload | `packages/core/src/matrix/client/providers/matrix-provider.tsx` |
| Timeline mapping | `packages/core/src/matrix/rich-reply.ts` |
| Chat composer + drafts | `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx`, `packages/epics/src/common/human-right-panel.tsx` |
| Chat bubbles | `packages/epics/src/common/human-chat-panel/human-chat-panel-message-bubble.tsx` |
| Proposal attachment list | `packages/ui/src/upload/attachments-list.tsx`, `packages/ui/src/upload/add-attachment.tsx` |
| Coherence tab (signals; future **Space Memory** UI) | `packages/epics/src/coherence/components/coherence-block.tsx`, `signal-section.tsx` — panel spec: [space-memory-panel.md](../plans/space-memory-panel.md) |

This file is the **high-level map**; the space-chat docs above go deeper on Matrix only.

Matrix chat attachments and this overview are on **`main`** ([PR #2133](https://github.com/hypha-dao/hypha-web/pull/2133), merged). Automatic org-memory catalogue wiring from chat remains **follow-up** (§4.2).
