# Human chat composer — world-class experience (tech spec)

**Status:** Ready for implementation (spec + phased delivery)  
**Owners (perspective):** Matrix SDK integration · Next.js / epics · UI/UX design system  
**Primary surfaces:** `HumanChatPanelChatBar`, `HumanRightPanel` (`packages/epics/src/common/`), `MatrixProvider.sendMessage` (`packages/core/src/matrix/client/providers/matrix-provider.tsx`)

---

## 1. Problem & outcome

The group chat composer already supports plaintext markup, emoji (picker + `:shortcode:`), selection toolbar formatting, and **rich reply preview** wired to Matrix `m.in_reply_to`. Several actions are **stubs** (`handleAttachFile`, `handleAttachImage`, `handleBold`, `handleMention`), and there is **no** voice input, video capture, upload progress, or structured “pending attachments” UX—gaps versus top-tier chat products (Slack, Teams, Discord, Element).

**Outcome:** A **single, calm composer** that handles new messages, replies, rich text, media, and dictation with clear states, accessibility, and Matrix-correct event payloads—implemented in **incremental PRs** following this spec.

---

## 2. UX principles (non-negotiable)

| Principle | Implementation hint |
|-----------|----------------------|
| **Progressive disclosure** | Default: text + send; secondary actions in icon row; overflow “+” on narrow widths. |
| **One mental model** | Reply = scoped **next send** only; dismiss restores “new message” mode (aligns with existing `replyDraft`). |
| **Keyboard-first** | Enter send, Shift+Enter newline, Escape closes popovers/reply/cancel recording (document in footer hints). |
| **Forgiving input** | On send failure, restore draft + reply state (already in `HumanRightPanel`); extend for attachment queue. |
| **Honest affordances** | Disable or hide dictation when `MediaRecorder` / `SpeechRecognition` unsupported; explain in tooltip. |
| **Accessible by default** | `aria-label` on every icon control; popovers trap focus or use dialog pattern; live regions for upload/errors. |
| **Performance** | Client-side resize/compress **before** upload; cap concurrent uploads; avoid blocking the main thread. |
| **Trust & safety** | Validate file type/size client-side; never `eval` pasted HTML; sanitize filenames for display. |

**Design system:** Use Hypha tokens (`bg-muted`, `border-border`, `text-muted-foreground`, `ring-ring`, `bg-accent-9` for primary send when spec calls for emphasis)—no arbitrary hex in new code. Minimum **44×44px** touch targets for mobile composer row (may require `h-9 w-9` icon buttons on `sm` breakpoint).

---

## 3. Current baseline (as-built)

| Area | Location / behavior |
|------|---------------------|
| Composer UI | `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx` |
| Markup → Matrix HTML | `packages/core/src/matrix/chat-markup.ts` (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `\|\|spoiler\|\|`, `> quote`) |
| Send + rich reply | `MatrixProvider.sendMessage` + `buildRichReplyMatrixContent` |
| Reply UX | `HumanRightPanel` passes `replyPreview` into chat bar; `onSend` includes `replyToEventId` |

---

## 4. Feature specification (implementation-ready)

Each item is **testable** and mapped to a suggested layer.

### F1 — Composer states

- **Empty:** placeholder, send disabled, hint row visible.
- **Typing:** auto-grow textarea (max height preserved), typing indicator hook **optional** (future: `m.typing` via Matrix—out of scope unless product confirms).
- **Reply mode:** existing preview bar; focus textarea on open; **Escape** dismisses reply (new).
- **Uploading:** attachment chips row above toolbar with per-file progress and cancel.
- **Recording audio:** distinct toolbar state (timer, pause/stop/cancel) before send.
- **Error:** inline banner on composer for Matrix / network / quota errors.

### F2 — Text & formatting (ship parity + polish)

- **Selection floating bar:** already implements bold/italic/strike/blockquote/code/spoiler—**wire bottom “Bold”** to `applyFormat('bold')` or remove duplicate to avoid confusion.
- **Markdown shortcuts (optional P2):** e.g. `Ctrl/Cmd+B` → bold wrap when selection non-empty.
- **Links (P2):** composer shortcut `Cmd+K` inserts `[label](url)` **or** prompt for URL; extend `chat-markup.ts` + HTML serializer to support safe links (`<a href>` with `rel="noopener noreferrer"` and allowlist `http/https/mailto`).

### F3 — Reply experience

- Keep **Matrix rich reply** as today (`m.in_reply_to` + fallback body).
- **Escape** clears `replyDraft` without sending.
- **Click reply preview** (optional): scroll timeline to target message if event id exposed via callback prop.

### F4 — Mentions (@)

- **`@` trigger:** after `@`, filter joined room members (from existing members hook / cache in panel); listbox keyboard nav like emoji colon menu.
- **Insertion format:** `@displayname` in plain body for readability (Matrix pills are P3 if using HTML mentions).
- **Stub replacement:** implement `handleMention` to insert `@` and open/typeahead.

### F5 — Emoji

- Keep `HumanChatPanelEmojiPicker` + colon typeahead.
- Ensure **Space** in colon menu does not break IME composition (respect `isComposing` where applicable).

### F6 — Attachments, images, video

**Matrix contract (SDK engineer):**

- Non-text messages use `m.room.message` with `msgtype`: `m.image`, `m.video`, `m.file` and `url` + optional `info` (thumbnail, dimensions, duration).
- Upload binary via **`uploadContent`** on `MatrixClient`, then send event with returned `mxc://` URI.
- Respect **`matrix-js-sdk@^40`** and avoid v41+ (Next/Turbopack); use **real room id** only.

**Product limits (tune per homeserver):**

| Kind | Max size (default proposal) | Client behavior |
|------|------------------------------|-----------------|
| Image | 15 MB | Resize (max edge 2048) + re-encode JPEG/WebP before upload when over threshold |
| Video | 50 MB (or server limit − margin) | Refuse with clear error; suggest trim if > cap |
| Generic file | 25 MB | Show file name + size chip |

**UX:**

- Hidden `<input type="file" multiple>` for paperclip (any) vs image (accept `image/*`) vs video (`video/*`).
- **Drag-and-drop** onto composer shell adds to queue.
- **Paste** images from clipboard → queue as image upload.
- Show **thumbnail** for images/video poster if available; spinner + retry on failure.

**API shape (fullstack engineer):**

- Extend `SendMessageInput` to accept `attachments: PendingAttachment[]` **or** add `sendMediaMessage` / `uploadAndSend` helper in `MatrixProvider` to keep `HumanRightPanel` thin.
- Composer calls **`matrixRef.current`** new method(s); panel passes `roomId` + `replyToEventId` rules: **first** message in batch may carry reply relation if product wants “reply with media”; default spec: **reply applies to first queued text-or-media event** only; subsequent are normal messages (document choice in implementation PR).

### F7 — Voice dictation

- Use **`window.SpeechRecognition`** / **`window.webkitSpeechRecognition`** when available.
- **Mic button:** toggle listening; show **pulsing** state + “Listening…”; append interim results to composer with debounce; **commit** on pause/stop.
- **Privacy:** indicate browser processing; no server-side audio unless explicitly added later.
- **Fallback:** hide mic when API missing; optional “Dictation not supported” tooltip.

### F8 — Inline video/audio recording (optional P2)

- **`MediaRecorder`** capture short clip (e.g. max 60s or size-based stop); preview before send; same upload path as F6.
- Requires HTTPS; handle permission errors gracefully.

### F9 — Footer & discoverability

- Extend `HumanChatPanel` i18n strings: `Enter` / `Shift+Enter` / `@` / `:` hints + **new:** `Ctrl+K` link (if shipped), dictation shortcut if any.
- Keep one line on desktop; wrap on mobile.

### F10 — Coherence / space parity

- Same composer component where `HumanRightPanel` is used; guard features by **`roomId` present** and matrix client ready.

---

## 5. Engineering tasks (suggested PR slices)

| Slice | Scope | Key files |
|-------|--------|-----------|
| **PR-A** | Wire stub buttons; Escape dismiss reply; footer copy; mobile touch targets | `human-chat-panel-chat-bar.tsx`, `human-right-panel.tsx`, locale JSON |
| **PR-B** | Matrix upload + `m.image` / `m.file` send; attachment queue UI | `matrix-provider.tsx`, new `matrix-upload.ts` helper, chat bar |
| **PR-C** | Video + compression + size guard | same + optional dependency (e.g. ffmpeg.wasm **only if** justified—prefer native `<video>` + server cap) |
| **PR-D** | `@` mention typeahead | panel data for members + composer popover |
| **PR-E** | SpeechRecognition dictation | composer + feature detect |
| **PR-F** | E2E Playwright: attach flow, reply+send, dictation mock | `apps/web-e2e/` |

Each slice should include **unit tests** for markup/link security if touching `chat-markup.ts`.

---

## 6. Matrix & protocol notes (SDK)

- **Room vs thread:** Space chat uses **room timeline** + `m.in_reply_to` only—**do not** attach `m.thread` for space-level chat (per Hypha mapping).
- **Rich reply + media:** Matrix allows relations on media events; verify `RoomMessageEventContent` typing when combining `m.relates_to` with `msgtype !== m.text`.
- **HTML messages:** Today custom format string is used for text HTML bodies—keep **consistent** with `matrix-js-sdk` expectations and Element rendering.
- **Error handling:** `uploadContent` may fail for quota/CORS—surface message, retain local blob until user discards.

---

## 7. Security & privacy

- **XSS:** Continue escaping in `chat-markup.ts`; for links, sanitize URL scheme.
- **CSRF:** N/A for Matrix client uploads (token on client)—ensure tokens never logged.
- **User media:** Request permissions only on user gesture; stop streams on unmount.

---

## 8. Telemetry (optional)

- Events: `composer_attachment_started`, `composer_attachment_failed`, `composer_dictation_started`—behind existing analytics policy.

---

## 9. Acceptance criteria (definition of done)

1. User can **attach image/file**, see progress, send, and see message in timeline with correct `msgtype`.
2. User can **reply** with text **or** (if implemented in slice) media following agreed relation rules.
3. **Mention** typeahead inserts at least `@` + substring selection for a member.
4. **Dictation** works on supported Chromium browsers; hidden elsewhere.
5. **WCAG:** keyboard operable popovers; visible focus; announcements for upload fail/success.
6. **No regressions** to plain text send + rich reply formatting.

---

## 10. References

- Matrix spec: [Rich replies](https://spec.matrix.org/latest/client-server-api/#rich-replies), [Room messages](https://spec.matrix.org/latest/client-server-api/#mroommessage)
- Matrix JS SDK: `MatrixClient#uploadContent`, `sendEvent`, `MsgType`
- Hypha requirements: [group-chat-reply](./Features/group-chat-reply/requirements.md), [group-chat-emoji](./Features/group-chat-emoji/requirements.md)
- Role constraints: `.agents/roles/senior-matrix-sdk-engineer.base.md` (SDK version, room id, thread semantics)

---

## 11. Open questions (resolve in first implementation PR)

1. **Homeserver max upload** — single constant vs fetch from `/media/r0/config` if available?
2. **Reply + multiple attachments** — one aggregated message vs multiple events?
3. **Video transcoding** — client-only vs accept native formats only?
