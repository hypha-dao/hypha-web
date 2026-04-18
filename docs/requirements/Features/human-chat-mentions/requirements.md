# Human chat — @mentions, highlights, and notification center

**Status:** Implementation in progress (mention pipeline, UI, inbox shipped; per-room notification policy UI pending)  
**Traceability**

| Item | Value |
|------|--------|
| Primary UI surface | Human group chat panel (`HumanRightPanel` + `HumanChatPanel*`), space mode and coherence / signal-thread mode |
| Related code today | `human-chat-panel-chat-bar.tsx` (mention control disabled), `matrix-chat-unread.ts` (highlight vs total counts), `human-chat-panel-message-bubble.tsx` (visual @ styling only), `AsideNotificationCentrePage` (push/email notification centre) |

---

## 1. Problem statement

The Matrix-backed **human chat** composer historically shipped with **@ mention** disabled; current work enables member pickers, **`m.mentions`** on send, **self-only row highlights**, **mention badges**, and a **mention inbox** with routing to the aside notification centre. **Per-room notification policy UI** (mute / all messages / mentions-only) remains to be implemented (§8).

**Stakeholder impact:** Anyone using space chat or signal threads who expects @mentions, mention notifications, and channel notification controls.

---

## 2. Goals and non-goals

### Goals

- **Composer:** Typing `@` opens a **member picker** scoped to users **relevant to the current chat context** (see §5.2).
- **Protocol:** Outgoing messages include **Matrix intentional mentions** (`m.mentions.user_ids` per MSC3952 / current spec) so homeservers compute **highlight** notifications reliably—not only plaintext substring matches.
- **Timeline:** Messages that **mention the current user** render with a **distinct background** for that user only (Discord-like).
- **Unread / badges:** **Unread mention count** appears on the **Chat** tab label and on a new **bell** in the chat header; counts reflect **highlight-class unread** where possible (see §7).
- **Mention inbox:** Bell opens a **side panel** listing **recent mention events** with avatar, actor, room/thread context, snippet, and navigation to the message.
- **Notification centre entry:** The existing **profile / aside** notification centre (`NotificationCentreForm`) remains reachable from that panel via a **settings-style** affordance (parity with profile menu).
- **Channel policies:** For each **room chat** and **signal thread context**, users can set **notification policy** (radio group aligned with design: category default, all messages, mentions only, nothing), backed by Matrix semantics (see §8).

### Non-goals (initial release)

- **Federated display-name ambiguity:** Resolving `@localpart` across servers beyond “pick from membership list” (picker is membership-based).
- **Full mobile parity** of the desktop side panel (reuse patterns, but scoped validation on web first).
- **Replacing** the aside-route notification centre; this feature **adds navigation** to it from chat.
- **Backend services** outside Matrix + existing `notifications` package unless explicitly required for push parity (client-first).

---

## 3. Definitions

| Term | Meaning |
|------|--------|
| **Current chat context** | Either the **space room timeline** (`HumanRightPanel` space mode) or a **signal / card thread** inside that room (coherence mode)—the set of members and thread metadata available to the panel. |
| **Intentional mention** | Matrix `m.room.message` content includes `m.mentions: { user_ids: string[] }` listing full MXIDs, per intentional mentions MSC3952. |
| **Highlight (Matrix)** | Notification classification that increments `NotificationCountType.Highlight` unread; typically driven by mentions + keywords + rules. Hypha treats **mention inbox + tab badge** as **highlight-first** (see §7). |
| **Unread mention message** | A timeline event where the user is in `m.mentions.user_ids`, the event is **after** the user’s effective read marker for that timeline, and it is classified as unread (highlight when available). |
| **Category default** | Product-defined default policy for a **class** of channels (e.g. by space type). Until categories are modeled in app config, implementation SHALL treat this as **“inherit user / server default”** (= **Only @mentions** behaviour for highlights, matching Matrix defaults) unless product specifies otherwise in approval. |

---

## 4. User stories

1. **As a** member composing a message, **I want to** type `@` and choose a member **so that** they are reliably notified and I don’t mistype MXIDs.
2. **As a** member who was mentioned, **I want** that message row **highlighted for me** **so that** I spot it quickly in a busy channel.
3. **As a** member with unread mentions, **I want** a **number** on the **Chat** tab **so that** I know mentions await before I scroll.
4. **As a** member with unread mentions, **I want** a **bell + count** in the chat header **so that** I see mentions even when I’m not on the Chat tab.
5. **As a** member, **I want** the bell to open a **side panel** listing mentions **so that** I can jump to context quickly (mobile notification centre serves as UX reference for row layout).
6. **As a** member, **I want** **per-room / per-thread** notification levels **so that** I can mute noisy channels or hear everything.
7. **As a** member, **I want** **notification centre** (push/email prefs) reachable from that panel **so that** I don’t hunt through the profile menu only.

---

## 5. Functional requirements

### 5.1 Composer — @ picker (FR-COMP-1 …)

**FR-COMP-1** When the caret is in the message composer and the user inserts **`@`** (or activates the previously disabled At toolbar control), the system SHALL open a **member suggestion list** filtered by **characters typed after `@`** (case-insensitive substring on display name and localpart).

**FR-COMP-2** The suggestion list SHALL include **only members applicable to the current chat context**, merging Matrix room membership with Hypha profile roster data where available:

- **Space room chat:** joined members of the Matrix room backing the space (`room.getJoinedMembers()` or equivalent) **plus** Members-tab / space-roster people that can be mapped to Matrix MXIDs through `matrix_user_links` (`Person.sub → matrixUserId`). When no roster mapping exists, `room.getJoinedMembers()` remains the source. **v1:** the current user SHALL be **excluded** from suggestions (§10).

**FR-COMP-3** **Signal / thread chat:** suggestions SHALL be the same membership **or** a subset explicitly defined by coherence (if thread participants are tracked separately, filter to **room members** still in the thread policy document—default to **room members** for v1).

**FR-COMP-4** Choosing a member SHALL insert a **canonical token** into the plaintext composer, e.g. `@displayname` or `@localpart:domain`, and SHALL record the corresponding **`user_id` (MXID)** in composer state for send-time merging.

**FR-COMP-5** On send, the system SHALL produce `m.mentions.user_ids` containing **every MXID** still referenced by outstanding `@` tokens in the outgoing body for that send (see §6.2). Removing `@SomeOne` from text before send SHALL remove them from `user_ids`.

**FR-COMP-6** Keyboard: Arrow keys navigate suggestions, Enter selects, Escape closes; screen readers get **live region** or listbox semantics consistent with `packages/ui` patterns.

### 5.2 Timeline — mention highlight for self (FR-VIEW-1 …)

**FR-VIEW-1** For the **current user only**, if `event.getContent()?.["m.mentions"]?.["user_ids"]` contains `currentUserId`, the message bubble outer container SHALL apply a **visible background tint** (Discord-like; use design tokens, e.g. amber/yellow subtle tint + dark mode variant).

**FR-VIEW-2** Parsing **fallback:** If `m.mentions` is absent (legacy events) but `body` / `formatted_body` contains an intentional `@mxid` or pill pattern the app historically emitted, MAY highlight only if **safe** (prefer **no** fallback ping if ambiguous).

**FR-VIEW-3** Mention **styling** inside text remains **distinct** from highlight (existing primary-tint pills may stay); highlight is **row-level**.

### 5.3 Chat tab + bell badges (FR-BADGE-1 …)

**FR-BADGE-1** The **Chat** tab (`HumanChatPanelTabs`) SHALL show a **numeric badge** when **unread mention count for that context** &gt; 0 (see §7). Badge MAY cap display (`99+`) consistent with existing unread patterns.

**FR-BADGE-2** `HumanChatPanelHeader` SHALL include a **bell** icon button showing the **same count** as the Chat tab badge (computed for the active chat panel context). In **thread / coherence mode (v1)**, that count SHALL remain **room-scoped** because Matrix highlight counters are **per room**, not per MSC thread id—same value as space chat for that room.

**FR-BADGE-3** Clicking the bell SHALL open the **mention side panel** (§5.4). Bell SHALL expose `aria-label` including count when &gt; 0.

### 5.4 Mention side panel (FR-PANEL-1 …)

**FR-PANEL-1** The panel SHALL be a **right-side or consistent `SidePanel` / sheet** matching Hypha patterns, title e.g. “Notifications” / “Mentions,” list **mention events** newest-first.

**FR-PANEL-2** Each row: **sender avatar**, **primary line** (`{name} mentioned you in {room or thread label}`), **relative time**, **snippet** with mention styling, optional quote bar; tap/click **navigates** to the message (focus timeline, scroll into view; for threads, open thread root if required).

**FR-PANEL-3** **Empty state** when no unread / no recent mentions (per product: show last N read or only unread—**default: unread-only** for badge alignment).

**FR-PANEL-4** Toolbar in panel: **Settings / gear** (or ellipsis) navigates to the existing **notification centre** experience (same **content** as `AsideNotificationCentrePage` / `NotificationCentreForm`), either by **routing to aside `notification-centre`** with close URL semantics mirroring `aside-notification-centre-page.tsx`, or by **embedding** the form inside the panel—implementation choice with preference for **reuse** of `NotificationCentreForm` and **one** canonical UX.

### 5.5 Channel notification settings (FR-NOTIFY-1 …)

**FR-NOTIFY-1** User SHALL open policy UI from chat context menu **or** bell menu (exact trigger: design; minimum **room-level** entry).

**FR-NOTIFY-2** Radio options SHALL match approved design:

1. **Use category default** — inherits §3 “Category default.”  
2. **All messages** — user receives notifications / unread counts for all messages in that context (maps to Matrix push rule behaviour or room override).  
3. **Only @mentions** — highlights / mentions only.  
4. **Nothing** — mute (no notifications from that context).

**FR-NOTIFY-3** **Mute channel** top action (see mock): either **subordinate** to “Nothing” or **shortcut** into mute sub-flow (design parity).

**FR-NOTIFY-4** Settings SHALL persist **per Matrix room** for space chat; **per signal thread** if technically feasible—see §8.3.

---

## 6. Technical specification (normative for implementers)

### 6.1 Touchpoints (existing)

| Area | Files / modules |
|------|------------------|
| Composer | `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx` |
| Panel wiring | `packages/epics/src/common/human-right-panel.tsx` |
| Send path | `packages/core/src/matrix/client/providers/matrix-provider.tsx` (`sendMessage`), `packages/core/src/matrix/chat-markup.ts` |
| Unread | `packages/epics/src/common/human-chat-panel/matrix-chat-unread.ts` |
| Bubble | `packages/epics/src/common/human-chat-panel/human-chat-panel-message-bubble.tsx` |
| Aside notification centre | `apps/web/src/components/aside-notification-centre-page.tsx`, `@hypha-platform/notifications/client` |

### 6.2 Outgoing message content

For **every** text send (including rich replies and optional edits):

1. Compute `mentionedUserIds: string[]` from composer `@` selections still present in plaintext for that send.
2. Merge into event content:

```json
{
  "msgtype": "m.text",
  "body": "...",
  "format": "org.matrix.custom.html",
  "formatted_body": "...",
  "m.mentions": {
    "user_ids": ["@user:server"]
  }
}
```

- When **also** replying (`m.in_reply_to`), **preserve** reply relation; mentions are orthogonal.
- **Media-only** sends with captions: merge `m.mentions` into the **caption text event** payload for the first text-bearing part per existing bundle rules.

**HTML:** Ensure `formatted_body` contains `<a href=\"https://matrix.to/#/@user:server\">` pills where Element-compatible, if the project HTML pipeline supports it—otherwise plaintext `body` must still contain `@localpart` for readability.

### 6.3 Incoming parsing

Extend `Message` type / normalizers in `packages/core/src/matrix/types.ts` (and timeline mapping in `matrix-provider`) with:

- `mentionedUserIds?: string[]` from `content.m.mentions.user_ids`.

### 6.4 Highlight styling predicate

```text
isMentionOfCurrentUser =
  currentUserId != null &&
  Array.isArray(event.mentionedUserIds) &&
  event.mentionedUserIds.includes(currentUserId)
```

Pass into `HumanChatPanelMessageBubble` as `highlightReason: 'mention' | null`.

### 6.5 Unread mention counts (tab + bell)

Today `computeHumanChatUnreadState` prefers **highlight** count when &gt; 0. Formalize:

**FR-UNREAD-1** **Tab + bell badge number** SHALL use **`room.getUnreadNotificationCount(NotificationCountType.Highlight)`** when the SDK returns a non-zero value; otherwise **0** for mention-specific badges (do **not** fall back to total unread for **mention** badge—prevents confusion). For **thread views (v1)**, this count is explicitly **room-level**, not filtered to the active thread—Matrix does not expose per-thread highlight totals.

**FR-UNREAD-2** If highlight is **unavailable** for a homeserver, document **degraded mode**: optional client-side scan of unread events with `m.mentions` **after** read receipt—**performance flag**, off by default for large rooms.

### 6.6 Mention inbox aggregation

**Primary index:** client-side listener on `RoomEvent.Timeline` (and thread timeline if separated) collecting events where `mentionedUserIds` contains self, **sorted by origin_server_ts descending**, **deduped by event id**.

**Retention:** In-memory for session + optional cap (e.g. 100). Persisted store is **non-goal** unless requested.

---

## 7. Matrix SDK notes (`matrix-js-sdk`)

- **Unread notifications:** `Room.getUnreadNotificationCount(NotificationCountType.Highlight | Total)` — already referenced in `matrix-chat-unread.ts`.
- **Listeners:** Continue `RoomEvent.UnreadNotifications`, `RoomEvent.Timeline`, `RoomEvent.Receipt` for badge refresh.
- **Intentional mentions:** Emit `m.mentions`; verify against project SDK typings—extend local content types if needed.
- **Version constraint:** Maintain Hypha standard (`^40.x`, per existing Matrix requirements docs in this repo); avoid APIs exclusive to newer majors unless the repo upgrades globally.

---

## 8. Notification policy — Matrix mapping

### 8.1 Expected behaviour

| UI option | Expected Matrix behaviour (conceptual) |
|-----------|----------------------------------------|
| **Use category default** | Inherit configured **category** policy when categories exist; until then inherit **server / user default** push rules (typically mention-forward). |
| **Only @mentions** | Explicit override: **mentions / highlights only** for this room (distinct from “inherit default”). |
| **All messages** | Room-level rule to notify on **all messages** in room. |
| **Nothing** | Room muted: **no** notifications for room (and optionally suppress counts—align with Element: muted rooms often still show unread but no push). |

### 8.2 Implementation approaches (pick one in implementation PR)

**Option A — Push rules API:** `MatrixClient` push rule helpers to add **room-specific** conditions (`room_id` matching) or toggle **rule enabled**—exact API surface depends on SDK v40 docs.

**Option B — Account data:** Some clients mirror mute state in account data; prefer **spec-aligned** push rules.

### 8.3 Signal threads caveat

Matrix notification granularity is primarily **per room**, not per MSC thread id. For **signal threads**, either:

- **v1:** Thread policy **UI** maps to **same room rules** (note limitation in UI copy), or  
- **Stretch:** Client-side filter using thread root id in local notification simulation only (does not affect server push—document honestly).

---

## 9. Non-functional requirements

**NFR-A11y** Bell, tab badges, picker, and panel comply with WCAG 2.2 AA for focus order, labels, and motion (respect `prefers-reduced-motion`).

**NFR-Perf** Mention inbox listener SHALL **not** full-scan timeline on every keystroke; incremental updates only.

**NFR-i18n** All new strings go through `next-intl` (`HumanChatPanel`, new namespace for mention panel if needed).

**NFR-Test** Unit tests for: mention token → `m.mentions` mapping, highlight predicate, unread badge math; Playwright smoke: `@` opens picker (optional if time).

---

## 10. Decisions (resolved for v1 implementation)

1. **Self-mention:** **Excluded** from the member picker (FR-COMP-2 recommendation); users cannot `@`-pick themselves in v1.  
2. **Category default:** Until first-class channel categories exist in Hypha config, **“Use category default”** SHALL mean **inherit server / user Matrix defaults** (same practical effect as Matrix’s default mention-forward behaviour).  
3. **Bell panel vs aside route:** **Aside navigation** to `…/notification-centre` (path derived from current locale + app section) for `NotificationCentreForm`—single canonical UX; mention **Sheet** lists mentions only.  
4. **Thread notification:** **Room-level policy only** in v1; thread-specific overrides are **non-goal** until Matrix or product defines them—UI copy SHALL note the limitation when opened from coherence / thread context.

---

## 11. Implementation plan (for conventional commits after approval)

Execute **one conventional commit per step** (example breakdown):

| Step | Scope | Suggested commit |
|------|--------|------------------|
| 1 | Types + send/receive path: `m.mentions` on send, `mentionedUserIds` on `Message`, normalize edits | `feat(matrix): add intentional mentions to message pipeline` |
| 2 | Composer UX: `@` picker in `HumanChatPanelChatBar`, enable At button | `feat(chat): member picker and mention insertion in composer` |
| 3 | Timeline: bubble highlight for current user mentions | `feat(chat): highlight messages that mention the current user` |
| 4 | Badges: derive mention count + wire `HumanChatPanelTabs` + header bell | `feat(chat): mention unread badges on chat tab and bell` |
| 5 | Mention side panel + navigation + link to notification centre | `feat(chat): mention notifications side panel` |
| 6 | Room / thread notification settings UI + Matrix push-rule wiring | `feat(chat): per-room notification policy and mute` |
| 7 | i18n, a11y polish, tests | `test(chat): mentions and notifications coverage` |

Dependencies: steps **1 → 2 → 3** are sequential; **4** depends on **1**; **5** depends on **1** and **4**; **6** can parallelize after **1** if staffed; **7** last.

---

## 12. Acceptance criteria (release gate)

- Sending a message with a picked `@user` yields **highlight** unread for that user on supported homeservers (manual cross-account test).
- Mentioned user sees **row highlight** only on their client.
- Chat tab + bell show **matching** mention counts when highlights work.
- Bell opens panel; rows navigate to messages; settings affordance reaches notification centre.
- Policy UI changes observable behaviour (mute / all messages) per §8.

---

## References

- Matrix Client-Server — mentions / intentional mentions (MSC3952): see current spec at `https://spec.matrix.org/latest/`  
- Matrix JS SDK: `https://matrix-org.github.io/matrix-js-sdk/`  
- Hypha domain mapping: `.agents/roles/senior-matrix-sdk-engineer.base.md`
