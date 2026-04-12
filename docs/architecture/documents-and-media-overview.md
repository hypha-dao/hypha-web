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
| **Who “owns” the file”** | The room’s homeserver | Hypha + file host |
| **Organisation memory** | Not wired here yet; could later index `mxc` or mirror bytes | Already part of proposal / space document model |

---

## 4. Security and limits (short)

- **Chat:** Matrix token is used for **upload** and for the **client**; media links for **inline display** use the normal unauthenticated media URL pattern so browsers can load images without sending a Bearer header on every `<img>`.
- **Size and types** are limited by the homeserver (chat) and by your **proposal validation** (agreements).
- **Encrypted Matrix rooms** would need a different attachment story; today’s chat path assumes **unencrypted** rooms.

---

## 5. Where to look in the repo

| Area | Main locations |
|------|----------------|
| Matrix send + upload | `packages/core/src/matrix/client/providers/matrix-provider.tsx` |
| Timeline mapping | `packages/core/src/matrix/rich-reply.ts` |
| Chat composer + drafts | `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx`, `human-right-panel.tsx` |
| Chat bubbles | `packages/epics/src/common/human-chat-panel/human-chat-panel-message-bubble.tsx` |
| Proposal attachment list | `packages/ui/src/upload/attachments-list.tsx`, `packages/ui/src/upload/add-attachment.tsx` |

This file is the **high-level map**; the space-chat docs above go deeper on Matrix only.
