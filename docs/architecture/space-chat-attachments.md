# Space chat attachments (files & images)

This document describes how the Human Chat panel handles **file** and **image** attachments in a Hypha Space, aligned with Matrix semantics and Discord-style UX.

## Goals

- **Two entry points:** paperclip (any file) vs gallery (images only), matching Discord’s composer pattern.
- **Draft / staging:** attachments appear above the composer with remove and optional spoiler before send.
- **Matrix delivery:** binaries are uploaded to the **homeserver content repository**; timeline events use `m.room.message` with `msgtype` **`m.file`** or **`m.image`** and an `mxc://` URL.
- **Human-readable thread:** messages render in the panel with image previews and file cards.

## Hypha ↔ Matrix mapping

- **Space** ↔ Matrix **room** (existing).
- **Chat message** ↔ `m.room.message` events on the room timeline.

There is no separate “organisation memory” write path in this implementation: media lives on the Matrix homeserver. A future integration can **mirror** the same bytes or `mxc://` URI into organisation memory when that pipeline is available.

## Upload and send flow

1. User picks files via hidden `<input type="file">` (different `accept` for image vs file).
2. Client stages `File` objects in memory (object URLs for previews).
3. On **Send**, for each staged file:
   - `client.uploadContent(file, { name: file.name })` → `content_uri` (`mxc://…`).
   - Build event content:
     - **`m.image`:** `url`, `body` (caption or filename), `info` (mimetype, size, optional `w`/`h` from a browser `Image()` decode).
     - **`m.file`:** same, without requiring image dimensions.
   - Optional **spoiler:** `org.hypha.spoiler: true` on the event; the Hypha UI blurs until clicked.
4. If the user is **replying** to a message, each uploaded event includes `m.relates_to` with `m.in_reply_to` (same as text replies).
5. If there is **text** in the composer, a separate **`m.text`** message is sent (after uploads). Order: **attachments first, then text**, so the text appears below in the timeline.

## Rendering

- Timeline mapping (`messageFromRoomMessageEvent`) exposes `msgtype`, `mxcUrl`, `filename`, and optional `mediaInfo` / `spoiler` on the shared `Message` type.
- The chat bubble renders:
  - **Image:** `<img>` via `client.mxcUrlToHttp(mxcUrl, …)` (thumbnail width capped for HiDPI).
  - **File:** card with filename, size, and link opening the HTTP URL in a new tab.

## Security and limits

- Upload size is constrained by the **homeserver** and browser; large files may fail with a clear error.
- **E2EE:** this path assumes **unencrypted** rooms (current Space/coherence setup). Encrypted rooms would require encrypted attachments per the Matrix spec; treat as a follow-up.

## Related code

- `packages/core/src/matrix/client/providers/matrix-provider.tsx` — `sendMessage` with optional `attachments`.
- `packages/core/src/matrix/rich-reply.ts` — maps `m.image` / `m.file` to `Message`.
- `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx` — draft UI and file pickers.
- `packages/epics/src/common/human-right-panel.tsx` — wires drafts to send.
- `packages/epics/src/common/human-chat-panel/human-chat-panel-message-bubble.tsx` — renders media.
