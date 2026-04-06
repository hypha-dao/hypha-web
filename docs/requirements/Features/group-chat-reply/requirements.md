# Group chat panel — message replies (Matrix rich replies)

**Status:** Ready for implementation  
**Traceability**

| Item | Value |
|------|--------|
| GitHub issue | [hypha-web#1952](https://github.com/hypha-dao/hypha-web/issues/1952) |
| Title (issue) | [Matrix SDK] Reply feature |
| Primary UI surface | Human group chat panel (`HumanRightPanel`, space mode) — Chat tab |

**Note:** This file lives under `docs/requirements/Features/` alongside other feature specs. The Obsidian vault workflow (`docs/requirements/Main Board.md`, templates) may later absorb or cross-link this document.

---

## 1. Problem statement

Space members use the right-hand **group chat panel** to converse in the Matrix room mapped to that space. Users expect to **reply to a specific message** (quote context, threaded UX) as in common chat products. Today, hover actions on a message bubble include a **Reply** control, but it is **disabled** and there is **no composer state** or **protocol-level reply** when sending.

**Stakeholder impact:** Any member using human chat in a space (and parity expectations for coherence-mode chat once the same components are wired).

---

## 2. Goals and non-goals

**Goals**

- Enable **replying to an existing room message** from the group chat panel using **Matrix Client-Server semantics** for **rich replies** (relation to a prior `m.room.message` event).
- Provide **clear UI**: enter reply mode from the message hover action, show **reply preview** above the composer, send with **one action**, **cancel** reply mode.
- Render **reply context** in the timeline: the new message shows **who is being replied to** and a **snippet** of the original (within reasonable limits).
- Extend the **Matrix integration layer** (`MatrixProvider` / `Message` type) so replies are **first-class** in data passed to the UI, not ad-hoc parsing only in one component.

**Non-goals**

- **Matrix threads** (`rel_type: m.thread`) for **space-level** chat — that model is reserved for **Coherence card/signal** conversations per [`.agents/roles/senior-matrix-sdk-engineer.base.md`](../../../../.agents/roles/senior-matrix-sdk-engineer.base.md). This feature is **room-timeline rich replies** only (`m.in_reply_to`).
- Full **Element-style** thread panel, **editing** messages, or **reactions** (separate work; hover buttons may stay scoped or disabled per product).
- **E2EE-specific** edge cases beyond what `matrix-js-sdk` already exposes for timeline events in use today.

---

## 3. Definitions

- **Space chat / group chat panel:** The `HumanRightPanel` in **`mode === 'space'`**, showing messages for the Matrix **room** associated with the current space.
- **Target message:** The `m.room.message` event in that room that the user chooses to reply to (identified by **event ID**).
- **Rich reply (Matrix):** An `m.room.message` whose content includes `m.relates_to` with `m.in_reply_to` pointing at the target event. See [Matrix specification — rich replies](https://spec.matrix.org/latest/client-server-api/#rich-replies) and [Relationship types](https://spec.matrix.org/latest/client-server-api/#relationship-types).
- **Reply preview:** Composer UI showing the **original sender** (display name or MXID fallback) and a **short excerpt** of the target body; user can dismiss before sending.
- **Implementation reference (Hypha):** `packages/core/src/matrix/client/providers/matrix-provider.tsx` (`sendMessage`, `getRoomMessages`, timeline listener) and `packages/core/src/matrix/types.ts` (`Message`).

---

## 4. User story

**As a** space member in the group chat panel,  
**I want to** reply to a specific message so that my response is linked to that message,  
**So that** others see what I am responding to and conversation context stays clear.

---

## 5. Functional requirements

**FR-1** The system SHALL show an **enabled** Reply control on each **real** chat message bubble when the user hovers (or equivalent focus/visibility pattern for keyboard users) in the group chat panel, and activating it SHALL enter **reply mode** scoped to that message’s Matrix event ID.

**FR-2** The system SHALL **not** offer reply-to-Matrix-event for the **synthetic welcome** message (`id === 'welcome'` in `HumanChatPanelMessages`) unless product later replaces it with a real event; Reply on that row SHALL be hidden or disabled with no reply mode.

**FR-3** While in reply mode, the system SHALL display a **reply preview** above the message input showing at least: **original author label** and **truncated excerpt** of the target message (suggested: max **280** characters, ellipsis for overflow).

**FR-4** The system SHALL provide a **dismiss** control (e.g. close icon) that clears reply mode and removes the preview without sending.

**FR-5** When the user sends a message **while in reply mode**, the system SHALL send an `m.room.message` whose content conforms to Matrix **rich reply** requirements: include `m.relates_to` with `m.in_reply_to` set to `{ "event_id": "<target_event_id>" }` for the target message in the **same room**.

**FR-6** The system SHALL include a **plaintext `body`** on the sent event that satisfies Matrix fallback rules for rich replies (quoted original line(s) followed by the new text), as specified in [Rich replies](https://spec.matrix.org/latest/client-server-api/#rich-replies), so clients that do not render structured replies still show readable history.

**FR-7** When the user sends a message **without** reply mode, the system SHALL **not** attach `m.in_reply_to`.

**FR-8** For each timeline message that is itself a reply, the system SHALL render **in the bubble** a **reply block** above the new text: show **original author** and **snippet** resolved from local timeline data (preferred) or from the fallback `body` if needed.

**FR-9** If the **target event is not available** locally (e.g. unknown event id, redacted original), the system SHALL still render the new message and show a **non-blocking** placeholder for the quoted context (e.g. “Original message unavailable”) rather than failing the panel.

**FR-10** Reply mode SHALL **not** change** room membership or mode**; it only affects the next outgoing event’s content until cleared or sent.

---

## 6. Non-functional requirements

**NFR-1** **Keyboard and screen reader:** Reply preview and dismiss control SHALL expose appropriate **accessible names** (reuse / extend `HumanChatPanel` i18n keys). Reply activation SHALL be feasible via **keyboard** (focus message actions, activate Reply) where hover-only is insufficient — align with existing panel patterns.

**NFR-2** **Performance:** Entering reply mode SHALL not trigger full timeline refetch; use already-loaded `Message` / event data from the current room timeline.

**NFR-3** **SDK version:** Implementation SHALL remain compatible with project constraints for `matrix-js-sdk` (see Hypha Matrix engineer role: **`^40.0.0`**, avoid `^41` in Next.js). Use `client.sendEvent(roomId, EventType.RoomMessage, content)` with the rich-reply payload; do not require a newer major unless explicitly upgraded project-wide.

---

## 7. Matrix / `matrix-js-sdk` contract (normative for implementers)

### 7.1 Outgoing event shape (space chat reply)

Send with `EventType.RoomMessage` and `msgtype` `m.text` (or project-standard text msgtype). Minimal relation:

```json
{
  "msgtype": "m.text",
  "body": "<fallback per Matrix rich reply rules>",
  "m.relates_to": {
    "m.in_reply_to": {
      "event_id": "$target_event_id"
    }
  }
}
```

Optional: `format` / `formatted_body` if the product already uses HTML bodies elsewhere; if not, plaintext `body` alone is acceptable for v1.

**Explicit non-use:** Do **not** set `rel_type: m.thread` on this feature for space chat (that is Coherence’s card-thread model).

### 7.2 Incoming parsing

When building UI messages from `MatrixEvent`:

- Read `event.getContent()?.["m.relates_to"]?.["m.in_reply_to"]?.event_id` to populate structured **reply metadata** on `Message`.
- Prefer resolving the quoted snippet from `client.getRoom(roomId)?.findEventById(inReplyToEventId)` or the room timeline; if missing, derive display text from the fallback `body` lines.

### 7.3 Hypha data model extension

**FR-11** The shared `Message` type (`packages/core/src/matrix/types.ts`) SHALL be extended to carry optional reply metadata, for example:

- `inReplyToEventId?: string`
- Optional: `inReplyToSender?: string`, `inReplyToBodyPreview?: string` (populated when resolvable)

The **`sendMessage` API** SHALL accept an optional `replyToEventId?: string` (or equivalent) and construct the Matrix content per §7.1.

---

## 8. Acceptance criteria

**AC-1** Given the user hovers a **real** message in the group chat panel,  
When they activate **Reply**,  
Then reply mode is active, the preview shows the correct author and excerpt, and the composer remains focused for typing.

**AC-2** Given reply mode is active,  
When the user activates **Dismiss** on the preview,  
Then reply mode clears and the next send is a normal message without `m.in_reply_to`.

**AC-3** Given reply mode is active and the user sends text,  
When the message is delivered,  
Then the created event includes `m.relates_to.m.in_reply_to.event_id` equal to the selected target event id.

**AC-4** Given a message in the timeline is a reply,  
When the panel renders it,  
Then the UI shows an inline reply context block above the new message body (author + snippet or placeholder per FR-9).

**AC-5** Given the user opens the panel in **space** mode with Matrix connected,  
When they reply and refresh or re-open the panel,  
Then the reply relationship still displays (same room, events loaded from sync).

---

## 9. Edge cases

| Scenario | Expected behavior |
|----------|-------------------|
| User selects Reply, then switches space / closes panel | Reply mode clears; no partial send. |
| Target message is redacted | Show placeholder snippet; still show relation if event id exists. |
| User replies to own prior message | Allowed; same rules as replying to others. |
| Very long original text | Preview truncated per FR-3; full text not required in preview. |
| Send fails (network / Matrix error) | Surface error per existing chat patterns; restore input + reply mode or clear per product choice — **document in implementation** (recommend: keep reply mode and text for retry). |

---

## 10. Implementation decomposition (suggested tickets)

1. **Core Matrix API:** Extend `Message`, `sendMessage`, `getRoomMessages`, and timeline listener to read/write reply metadata (`matrix-provider.tsx`, `types.ts`).
2. **Panel state & composer:** Reply mode state in `HumanRightPanel` (or dedicated hook), pass `onReply` to `HumanChatPanelMessages` / bubble, reply preview component above `HumanChatPanelChatBar`.
3. **Bubble UI:** Render reply block; enable Reply button; wire i18n.
4. **QA:** Playwright scenario — open panel, send two messages, reply to first, assert preview + relation (or DOM structure / test ids). Optional: stub Matrix in unit tests for content shape.

---

## 11. Open questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-1 | Should coherence-mode chat (`mode === 'coherence'`) get reply in the **same** release as space chat? | Product | **Default:** same implementation if it shares `HumanRightPanel` / `sendMessage`; flag if scope must be space-only. |
| OQ-2 | HTML `formatted_body` for replies required in v1, or plaintext only? | Engineering | **Default:** plaintext `body` only unless HTML is already standard for all panel messages. |

---

## 12. References

- Matrix: [Client-Server API — Rich replies](https://spec.matrix.org/latest/client-server-api/#rich-replies)
- `matrix-js-sdk`: [MatrixClient.sendEvent](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#sendEvent)
- Hypha: `.agents/roles/senior-matrix-sdk-engineer.base.md` (Space→Room mapping; **thread** vs **reply** distinction)

---

## 13. Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-06 | Requirements + Matrix (agent) | Initial ready-to-implement spec for #1952 |
