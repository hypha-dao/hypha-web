# Group chat panel — emojis (composer + reactions, Matrix SDK)

**Status:** Ready for implementation  
**Traceability**

| Item               | Value                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub issue       | [hypha-web#1948](https://github.com/hypha-dao/hypha-web/issues/1948)                                                                                             |
| Title (issue)      | [Matrix SDK] Add Emojis to Chat                                                                                                                                  |
| Primary UI surface | Human group chat panel (`HumanRightPanel`, space mode) — Chat tab                                                                                                |
| Related spec       | [Group chat — message replies (Matrix rich replies)](../group-chat-reply/requirements.md) ([hypha-web#1952](https://github.com/hypha-dao/hypha-web/issues/1952)) |

**Note:** This file lives under `docs/requirements/Features/` alongside other feature specs.

---

## 1. Problem statement

Space members use the **group chat panel** to talk in the Matrix room mapped to the space. The UI already shows **emoji affordances** (composer toolbar smile control, per-message “react” in the hover bar), but they are **inert or disabled**, and **reaction chips** on bubbles are not backed by **Matrix** data. Users expect behavior comparable to **modern team chat** (e.g. Discord): **insert emoji while composing**, **react to messages** with quick feedback, and **see counts** update in real time—without breaking **reply mode** or other composer flows.

**Stakeholder impact:** Anyone using human chat in a space; sets expectations for coherence-mode chat when the same components are shared.

---

## 2. Goals and non-goals

**Goals**

- **Composer — emoji entry:** Activating the **smile** control opens an **emoji picker** (categorized grid, keyboard-friendly). Choosing an emoji **inserts** it at the caret in the message field (or appends if there is no selection). Support **Escape** to close the picker without sending.
- **Composer — shortcode autocomplete (Discord-like):** When the user types **`:`** followed by characters, offer a **filterable list** of emoji **shortcodes** (e.g. `:smile:` → 😄); accepting a choice inserts the Unicode emoji and removes the trigger text. **Colon edge cases to validate:** Matrix room aliases and IDs use leading `#` / `!` and `:` as server separators (e.g. `#room:example.com`, `!abc:server`)—those patterns are **not** in the composer’s plain-text field the same way, but implementers SHOULD ensure a lone **`:`** at the start of a line or after whitespace only opens shortcode mode (not mid-token inside pasted MXIDs). Product **slash commands** are out of scope for v1; if added later, **escape** shortcode mode when the line starts with `/` or document a different trigger. **Delimiter behavior:** only the **first `:`** after whitespace or at the beginning of the textarea starts the shortcode filter; typing another `:` cancels or completes per FR-5–FR-7.
- **Timeline — reactions:** For each **real** `m.room.message` (not the synthetic welcome row), users can **add** and **remove** their own reaction using Matrix **`m.reaction`** events (**annotation** relations). The UI shows **aggregated** reaction rows (emoji + count), updates live from the SDK timeline, and allows **toggle** (second click on the same emoji by the same user removes their reaction via **redaction** of their `m.reaction` event, per Matrix semantics).
- **Integration with replies:** Emoji insertion in the composer **does not** clear [rich reply mode](../group-chat-reply/requirements.md); the outgoing message remains an `m.room.message` with optional `m.in_reply_to` when reply mode is active. Reactions are **orthogonal** to replies (annotations target the message event, not the reply relation).
- **Matrix integration layer:** Extend the shared **`Message`** model and **`MatrixProvider`** (or equivalent) so **reactions** are **first-class** (loaded, merged, exposed to UI) rather than mocked in components.

**Non-goals**

- **Custom server / sticker packs** beyond Unicode emoji in v1 (MSC-2545-style custom emoji can be a later epic).
- **Matrix threads** (`rel_type: m.thread`) for space-level chat — unchanged; see [senior-matrix-sdk-engineer mapping](../../../../.agents/roles/senior-matrix-sdk-engineer.base.md).
- **Editing messages** or **full Element parity** for the timeline.
- **Guaranteeing** a specific third-party picker library; the spec defines **behavior**—implementation selects a maintained picker that fits bundle-size and a11y constraints.

---

## 3. Definitions

- **Space chat / group chat panel:** `HumanRightPanel` with **`mode === 'space'`**, timeline for the space’s Matrix **room**.
- **Target message (reaction):** An `m.room.message` event in that room, identified by **event ID**, that reactions attach to via annotation.
- **Reaction (Matrix):** An event of type `m.reaction` whose content includes `m.relates_to` with `rel_type: m.annotation`, `event_id` = target message, and `key` = emoji string (Unicode scalar sequence as used by Matrix). See [Matrix specification — reactions](https://spec.matrix.org/latest/client-server-api/#annotations) and relationship types.
- **Rich reply:** As in [#1952](../group-chat-reply/requirements.md): `m.room.message` with `m.relates_to.m.in_reply_to` — **not** used for reactions; reactions use **`m.reaction`**, not `m.in_reply_to`.

---

## 4. User stories

**US-1** As a member composing a message, I want to **open an emoji picker** and **insert emoji** into my text so I can express tone without leaving the keyboard flow.

**US-2** As a member, I want to type **`:`** and pick from **shortcode suggestions** so I can add emoji quickly like in Discord.

**US-3** As a member, I want to **react to a message** with an emoji and **see others’ reactions** update live, so conversation feels responsive.

**US-4** As a member **replying to a message**, I want to **add emoji to my reply text** and still **send a proper Matrix reply** (rich reply), so emoji does not break threading context.

---

## 5. Functional requirements

### 5.1 Composer — picker and insertion

**FR-1** The system SHALL enable the composer **smile** control (`HumanChatPanelChatBar`) so that activation **opens** an emoji picker **anchored** to the control (or an accessible dialog pattern), and **closes** on **Escape** or outside click per existing focus patterns.

**FR-2** The system SHALL **insert** the selected emoji into the composer **at the text caret**; if there is no caret, it SHALL **append** to the end. Insertion SHALL **preserve** any active **reply preview** state ([FR-3–FR-5 in reply spec](../group-chat-reply/requirements.md)).

**FR-3** The picker SHALL present **categories** (e.g. Smileys & People, Animals & Nature, Food, Activities, Travel, Objects, Symbols, Flags) and a **search or filter** affordance when the dataset supports it.

**FR-4** The composer SHALL continue to use **Enter** to send and **Shift+Enter** for newline; inserting emoji SHALL not send the message.

### 5.2 Composer — shortcode autocomplete

**FR-5** When the user types **`:`** and continues typing letters (and optionally `_`), the system SHALL show a **dropdown** of matching emoji shortcodes (filter-as-you-type). Choosing an item SHALL replace the **`:` + filter fragment** with the chosen Unicode emoji.

**FR-6** If the user types a **complete** shortcode followed by boundary (e.g. space or punctuation), the system MAY auto-replace with emoji (product choice); if not implemented, **FR-5** alone satisfies v1.

**FR-7** Autocomplete SHALL be **dismissible** with **Escape** without sending; it SHALL **not** trap focus in a way that blocks **Shift+Enter** for new lines (align with NFR below).

### 5.3 Timeline — display and interaction

**FR-8** For each **real** Matrix `m.room.message` row in the UI (not **synthetic** system rows), the system SHALL render **aggregated reactions** under the bubble when at least one reaction exists, showing **emoji** and **count**, grouped by **`key`**. Synthetic rows are identified in the UI model with a boolean such as **`isSynthetic`** (or equivalent); the welcome row uses **`isSynthetic: true`**.

**FR-9** The hover / focus-within **React** control on a message SHALL be **enabled** only when **`canReact(message)`** is true (e.g. `!message.isSynthetic` and the row maps to a real Matrix event id), and SHALL open a **reaction picker** (may reuse the same picker component as the composer with a distinct `aria-label`) or a **compact quick-reaction strip** plus “more” opening the full picker.

**FR-10** Choosing an emoji from the message-level React UI SHALL **send** an `m.reaction` annotation for that message’s event id. If the user already reacted with the **same key**, the system SHALL **remove** that reaction (redact the user’s `m.reaction` event for that key), so behavior matches common chat **toggle** semantics.

**FR-11** The system SHALL **not** send reactions for **synthetic** system messages (`isSynthetic` or equivalent). The **React** affordance SHALL remain **hidden or disabled** for those rows (consistent with reply rules in the reply spec).

### 5.4 Matrix API surface (Hypha)

**FR-12** The shared **`Message`** type (`packages/core/src/matrix/types.ts`) SHALL include optional **reaction** metadata, for example:

- `reactions?: { key: string; count: number; includesCurrentUser?: boolean; currentUserReactionEventId?: string }[]`

(`currentUserReactionEventId` supports redacting the user’s own `m.reaction` when toggling off; sorted key order is implementation-defined; counts MUST reflect aggregation rules below).

**FR-13** **`MatrixProvider`** (or the module that owns `sendMessage` / timeline listeners) SHALL expose **sendReaction** / **toggleReaction** (names flexible) that:

- Send `client.sendEvent(roomId, 'm.reaction', { 'm.relates_to': { rel_type: 'm.annotation', event_id, key } })` for **add**, and
- **Remove** the current user’s prior reaction for that `(event_id, key)` via **redaction** of the corresponding `m.reaction` event id when toggling off.

**FR-14** Timeline processing SHALL **listen** for `m.reaction` events (and redactions) and **update** aggregated reactions on the target `m.room.message` in UI state. **Initial load and pagination:** When messages are first built from the room timeline (including scrollback), the system SHALL aggregate **all existing** `m.reaction` events for each `m.room.message` and populate `Message.reactions` (same rules as live updates)—e.g. **`attachReactionsToMessage`** after **`messageFromRoomMessageEvent`**, or equivalent relation queries. Implementation SHALL use **`matrix-js-sdk`** facilities for relations/annotations where available (e.g. aggregated relations APIs), or merge manually from the room timeline. **Deduplication (races):** If multiple `m.reaction` events exist from the **same sender** with the **same key**, the implementation SHALL count **one** reaction per sender+key for display: treat the **latest** non-redacted event by **`origin_server_ts`** as canonical for **`includesCurrentUser`** / **`currentUserReactionEventId`**; older duplicates MUST NOT inflate counts. **Toggle-off:** Redact the canonical **`m.reaction` event id** for the current user+key (if duplicates exist, redact the tracked id; homeserver may leave orphans—acceptable for v1).

**FR-15** Implementation SHALL remain compatible with **`matrix-js-sdk@^40.0.0`** (Hypha constraint; avoid `^41` in Next.js until upgraded project-wide).

---

## 6. Non-functional requirements

**NFR-1** **Accessibility:** Picker and autocomplete MUST be operable with **keyboard** (Tab / arrow keys / Enter as appropriate), expose **visible focus**, and provide **accessible names** (reuse / extend `HumanChatPanel` i18n keys). Touch targets SHOULD meet at least **44×44 CSS px** where feasible.

**NFR-2** **Performance:** Emoji datasets and picker UI SHOULD be **lazy-loaded** (dynamic import) so initial panel load is not dominated by emoji metadata.

**NFR-3** **Privacy / abuse:** In v1, **`key`** on outgoing **`m.reaction`** events MUST be a **Unicode emoji** string. The system SHALL **validate** every `key` before **`client.sendEvent`** (reject or no-op invalid values). Allowed inputs in-product are FR-1 (picker) and FR-5 (shortcode → native emoji); validation is **defense in depth** against future code paths or malformed state.

**NFR-4** **Ordering:** Reaction chips SHOULD be ordered **deterministically** (e.g. by count descending, then key) for stable UI.

---

## 7. Matrix / `matrix-js-sdk` contract (normative for implementers)

### 7.1 Outgoing reaction (annotation)

Use event type **`m.reaction`** (string; align with SDK `EventType` if defined). Minimal content:

```json
{
  "m.relates_to": {
    "rel_type": "m.annotation",
    "event_id": "$target_room_message_event_id",
    "key": "👍"
  }
}
```

**Remove (toggle off):** Redact the **`m.reaction` event_id** that the current user previously sent for that reaction, using `client.redactEvent(roomId, reactionEventId)` (or equivalent SDK API).

### 7.2 Incoming aggregation

For each `m.room.message` event id shown in the panel:

- Collect `m.reaction` events whose `m.relates_to.event_id` matches and `rel_type` is `m.annotation`.
- Group by `key`; count distinct sending users per key (or follow Matrix aggregation rules your homeserver exposes).
- Mark `includesCurrentUser` when the current user’s reaction event for that key is present and not redacted.

### 7.3 Orthogonality to rich replies

- **Reactions** MUST NOT use `m.in_reply_to`.
- **Rich replies** MUST NOT use `m.reaction`. Composer sends **either** a normal text message **or** a rich reply text message per [#1952](../group-chat-reply/requirements.md); emoji are **characters inside `body`**.

---

## 8. Acceptance criteria

**AC-1** Given the user focuses the composer and opens the emoji picker, when they select an emoji, then the emoji appears in the textarea at the insertion point and no message is sent.

**AC-2** Given **reply mode** is active ([reply spec](../group-chat-reply/requirements.md)), when the user inserts emoji and sends, then the outgoing event includes `m.in_reply_to` as specified for replies **and** the visible body contains the emoji characters.

**AC-3** Given a real message in the timeline, when the user adds a reaction via the message react control, then an `m.reaction` with `rel_type: m.annotation` and the correct `event_id` and `key` is sent.

**AC-4** Given the user already reacted with 👍 on a message, when they trigger toggle on 👍 again, then their reaction is removed (redaction) and the count updates.

**AC-5** Given another member adds a reaction, when the timeline receives the event, then the reaction row updates **without** full page reload.

**AC-6** Given the synthetic welcome message, when the user inspects hover actions, then **react** is not available in a way that sends Matrix traffic (disabled or hidden).

---

## 9. Edge cases

| Scenario                                  | Expected behavior                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Reaction send fails (network)             | Surface error per existing chat patterns; do not fake-update counts.         |
| Target message redacted                   | Hide or clear reactions for that target per SDK/timeline; do not crash.      |
| Duplicate reactions from same user (race) | Aggregator dedupes by user + key; final state consistent after sync.         |
| Very large number of distinct emoji keys  | Cap visible chips with “+N” or scroll row (implementation choice; document). |

---

## 10. Implementation decomposition (suggested tickets)

1. **Matrix core:** Extend `Message`, timeline listeners, `sendReaction` / `toggleReaction`, aggregation + redaction handling (`matrix-provider.tsx`, `types.ts`). Include **`messageFromRoomMessageEvent`** / **`rich-reply.ts`** (or the call site that maps `MatrixEvent` → `Message`): after building each room message, **attach** aggregated reactions (e.g. **`attachReactionsToMessage`**) so initial load, pagination, and live updates all populate `reactions`, `includesCurrentUser`, and **`currentUserReactionEventId`** for toggle/redaction.
2. **Composer UI:** Wire smile button, lazy-load picker, caret insertion, i18n + a11y.
3. **Shortcode autocomplete:** Tokenize `:` prefix, filter list, keyboard nav.
4. **Bubble UI:** Enable react button, show aggregated chips, hook toggle + live updates.
5. **QA:** Playwright flows — open picker insert emoji; react and unreact; reply + emoji send (assert via test hooks or Matrix stub).

---

## 11. Open questions

| ID   | Question                                                                    | Owner       | Default                                                      |
| ---- | --------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| OQ-1 | Should coherence-mode chat get emoji in the **same** release as space chat? | Product     | Same implementation if components are shared.                |
| OQ-2 | Preferred emoji dataset / picker package (bundle vs a11y tradeoffs)?        | Engineering | Pick lazy-loaded, maintained package; document in ADR or PR. |

---

## 12. References

- Matrix: [Annotations / reactions](https://spec.matrix.org/latest/client-server-api/#annotations)
- Matrix: [Rich replies](https://spec.matrix.org/latest/client-server-api/#rich-replies) (composer reply behavior — [#1952](../group-chat-reply/requirements.md))
- `matrix-js-sdk`: [MatrixClient.sendEvent](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#sendEvent), redaction APIs
- Hypha: `.agents/roles/senior-matrix-sdk-engineer.base.md` (reaction example; Space→Room mapping)

---

## 13. Revision history

| Version | Date       | Author                        | Changes                                   |
| ------- | ---------- | ----------------------------- | ----------------------------------------- |
| 1.0     | 2026-04-07 | Requirements + Matrix (agent) | Initial ready-to-implement spec for #1948 |
