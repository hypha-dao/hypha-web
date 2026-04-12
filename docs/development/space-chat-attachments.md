# Developer guide: Space chat attachments

## Overview

The Human Chat panel supports **staging** files/images in the composer and **sending** them as Matrix `m.room.message` events (`m.file` / `m.image`) after upload to the homeserver content API.

## Prerequisites

- Matrix client initialised (`useMatrix()`), user authenticated.
- Room ID for the current Space or coherence conversation.

## Key APIs

### `sendMessage` (Matrix provider)

Located in `@hypha-platform/core/client` (`matrix-provider.tsx`).

Parameters:

| Field | Type | Description |
|--------|------|-------------|
| `roomId` | `string` | Matrix room id |
| `message` | `string` | Composer text (may be empty if only attachments) |
| `replyToEventId` | `string?` | Rich reply target |
| `attachments` | `SendAttachmentInput[]?` | Staged files to upload and send |

`SendAttachmentInput`:

- `file: File` — browser `File` from `<input type="file">`.
- `kind: 'file' \| 'image'` — drives `msgtype` (`m.file` vs `m.image`). The image button sets `accept` to images only; users can still pick non-images via the file button.
- `spoiler?: boolean` — Hypha-only blur until click (`org.hypha.spoiler` on the event).

Send order: **each attachment** is uploaded in parallel (`Promise.all` over `prepareMediaPayload`), then **sent as separate events in list order**; if `message.trim()` is non-empty, a **text** event is sent last. If sending fails after some media events were committed, `sendMessage` throws **`SendMessagePartialFailureError`** (`sentAttachmentCount`, `restoreCaption`) so the UI can restore only the unsent remainder.

### `Message` type extensions

For timeline rows, `Message` may include:

- `msgtype` — `'m.text' \| 'm.file' \| 'm.image'` (and other Matrix types fall back to text extraction).
- `mxcUrl` — `mxc://` URI for the primary media.
- `filename` — display name.
- `mediaInfo` — `{ mimetype?, size?, w?, h? }`.
- `spoiler` — boolean for image blur overlay.

## UI components

### `HumanChatPanelChatBar`

- Maintains **draft attachments** in parent state (`HumanRightPanel` passes `draftAttachments` and `onDraftAttachmentsChange`). Inline remove/spoiler/toggle are implemented inside the bar by updating that list.
- Hidden file inputs: `accept` for image picker vs broad file picker.

### `HumanChatPanelMessageBubble`

- Renders `message.media` when `msgtype` is `m.file` or `m.image`.
- Uses `useMatrix().client` for `mxcUrlToHttp`: **download** URL (no width/height) for `m.file` links, **thumbnail** URL (e.g. 800×600, `scale`) for `m.image` previews.

## Testing manually

1. Open a Space, open the chat sidebar.
2. Use paperclip → pick a PDF; use image → pick a PNG.
3. Optionally toggle spoiler on an image draft.
4. Send with or without caption text; verify timeline shows file card / image.
5. Reply to a message, attach a file, send — attachment event should reference the reply target.

## Troubleshooting

- **Upload fails:** check homeserver logs / max upload size; browser network tab for `/_matrix/media/v3/upload`.
- **Image not showing:** confirm `mxcUrlToHttp` returns a URL (authenticated media may need `useAuthentication: true` in newer SDK versions — adjust if your HS requires auth for downloads).
