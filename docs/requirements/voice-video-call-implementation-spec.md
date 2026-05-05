# Implementation specification — Voice and video call (Space room + Signal thread context)

## Document control

| Field            | Value                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Ready to implement                                                                                                                                         |
| **Parent**       | [voice-video-call-matrix-tech-spec.md](./voice-video-call-matrix-tech-spec.md)                                                                             |
| **Plan**         | [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md) — phased steps, world-class acceptance criteria, recording/transcript |
| **Phase 0**      | [voice-video-call-phase-0-runbook.md](./voice-video-call-phase-0-runbook.md) — HS/TURN, `pnpm run check:matrix-sdk`, CSP                                   |
| **SDK**          | `matrix-js-sdk@^40.0.0` (no v41+ in Next.js until platform upgrade)                                                                                        |
| **Architecture** | **Option A** — `GroupCall` on **Space `roomId`**; **`threadRootEventId`** is **app context + optional timeline notice** only                               |

---

## 1) Locked product semantics (normative for v1)

| Topic                        | Decision                                                                                                                                                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Call scope**               | **One active Matrix group call per Space (`roomId`)** at a time. Parallel “different thread, different call” in the **same** Space is **out of scope** for v1 (see parent doc).                                                                                                               |
| **Who can be in the call**   | **All members of the Matrix room** (Hypha Space) may join; the SDK does **not** enforce thread-only membership. UI **must** label the call as **space-wide** (e.g. “Space call”) to avoid implying thread isolation.                                                                          |
| **Join when call already active** | **Joining** the room’s existing `GroupCall` uses the **same** `enter` path as **starting** a call (phone / video). When **other** members’ devices are in the `GroupCall` and the user is **idle**, the UI **shall** show a **call in progress** strip and **Join**-style copy on the header tools. The hook **shall** subscribe to the **room** `GroupCall` while idle to read `participants` from **Matrix member state** (and refresh on `ParticipantsChanged` and `GroupCall.ended`). The in-call strip **shall** show **device** count in the room and, when `connected`, **“others”** = `max(0, count − 1)` for clarity. **Join alert** — **§1.2.1** (chime + strip toggle + optional background `Notification`) **implemented** in `use-call-join-chime` + `HumanChatPanelCallJoinStrip`; **§1.2.2** (invitation modal) **TBD** unless a later PR ships it. **Also:** `useSpaceGroupCall` + `HumanChatPanelCallJoinStrip` + members tab hint. |
| **Signal / thread role**     | **`threadRootEventId`** identifies **which Signal** initiated or last focused the call UI; used for optional **thread notice** messages and analytics—not for access control.                                                                                                                 |
| **Modes**                    | **Audio-first** and **Video** entry points: both use **`GroupCall`**; video intent enables camera when entering (subject to permissions).                                                                                                                                                     |
| **Coherence vs Space panel** | **v1:** Implement for **`HumanRightPanel` space mode** (`mode === 'space'`) where the panel has a resolved **`roomId`** for the Space. **Coherence mode** (`mode === 'coherence'`) is **out of scope** unless the same `roomId` + thread rules are explicitly extended in a follow-up ticket. |

### 1.1 Join call and idle room `GroupCall` **subscription** (normative)

This subsection locks **how** a second (or Nth) member **joins** the **same** Matrix session and **how** the client stays informed **before** the local user has entered, so the product does not show “phantom” separate calls.

**Product rule — single session path:** `enterAudio` / `enterVideo` (§2) SHALL resolve the **room’s** `GroupCall` with **`getGroupCallForRoom(roomId)`** first, then **`createGroupCall`** only if **null**. A user who taps **join** is **not** creating a second parallel `GroupCall` in the same Space; they **enter** the one tied to the room. **Rationale:** `GroupCall` is **room-scoped**; duplicate “invisible” sessions in one room are a client bug or HS state inconsistency, not a valid v1 use case.

**Count semantics:**

| Quantity | Source | Use in UI |
| -------- | ------ | --------- |
| **Device count** | Sum of **devices** in `GroupCall.participants` (each `RoomMember` → per-device map size). | Accurate **N devices in call** for the join strip, banner, and i18n `callJoinStripDevices` / `callDeviceCountInRoom`. |
| **In-call user IDs** | Union of `RoomMember.userId` for any device in `participants`. | Members tab hints and roster (user count can be **lower** than device count if one user has **multiple** devices). |

**When to show “a call is in progress — you can join” (gate):** The **join affordance** (§3.2.1) SHALL appear only when the local user is **not** in the active session (`callState` is `idle` or a recoverable `error`), the **idle** room participant (device) count is **> 0**, and the app has a resolved **`roomId`**. It SHALL **not** show while `connecting` | `connected` | `disconnecting` (those are **in-our-session** states).

**Idle `GroupCall` subscription (hook behavior):** While the local user is **idle** (or in `error` recovering to idle) and `client` + `roomId` are set, the implementation **shall** attach to the **room**’s current `GroupCall` (if any) and:

1. **Re-read** participant state from `GroupCall.participants` (device count + user id set) on mount and when:
   - **`GroupCallEvent.ParticipantsChanged`** fires on that instance, and
   - The client receives **`GroupCall.ended`** (internal event name in matrix-js-sdk; the room’s active group call has ended or been replaced — implementation syncs to clear or refresh counts), scoped to the same `roomId` when the payload exposes it.
2. **Clear** idle join state to **0 devices** when `getGroupCallForRoom(roomId)` returns **null** or the participant read yields **0** devices.
3. **Tear down** listeners when `roomId` / `client` changes, on unmount, and when the local user **joins** (in-session path takes over with the same `GroupCall` and its own listeners including feed-driven participant updates).

**After the local user enters:** Participant counts and roster ids SHALL continue to use the **in-session** `GroupCall` (including updates from `ParticipantsChanged`, `UserMediaFeedsChanged`, and `ScreenshareFeedsChanged` as needed). **`othersInRoomCallCount`:** when in-session, **`max(0, participantCount − 1)`**; when idle, equals **all** devices in the room call (every device is an “other”).

**Exposed API (normative):** The hook **shall** expose at least: **`roomGroupCallDeviceCount`**, **`othersInRoomCallCount`**, **`inCallUserIdsForRoster`**, **`showRoomCallInProgress`**, and pass **`participantSummary` / `others`** consistent with the table above. See **§2.2**.

**UI mapping:** **§3.2.1** (header strip, toolbar “Join” copy, members tab). **Files (reference):** `use-space-group-call.ts`, `HumanChatPanelCallJoinStrip`, `HumanChatPanelCallToolbar`, `HumanChatPanelMembers`, `HumanRightPanel`.

### 1.2 Join **alert** (ring) and **join invitation** (modal) — *ring: implemented; modal: TBD*

**Scope:** Strengthens **discoverability** for idle members: **non-blocking** but **noticeable** feedback when a **room call** becomes active while the user is **not** in the session. **No new Matrix API** — pure **client** UX and optional **Web Audio** / **browser notification**; the **same** `enterAudio` / `enterVideo` paths as **§1.1**.

**Gates (when alert + modal are allowed to fire):**

- Same as **`showRoomCallInProgress`**: local user is **idle** (or in recoverable `error` per **§1.1**), **`roomId`** resolved, **`roomGroupCallDeviceCount > 0`**.
- **Shall not** play or open while the user is **in-session** (`connecting` … `disconnecting`), or after the user has **dismissed** the invitation for the **current** “join opportunity” (see throttling), or if the user (or org policy) has **disabled** join alerts.

**1.2.1 Audible ring (“nice” tone)**

| Rule | Normative text |
| --- | --- |
| **Purpose** | Brief, pleasant **attention** sound — **not** a siren, **not** endless ringtone; product should favor a **short** chime (e.g. **1–3 s** total) or a **small** number of **repeats** (e.g. 2) then **silence** until a **new** join opportunity (throttling). |
| **Tech** | Prefer a **dedicated** asset (e.g. small **`.ogg` / `.m4a`** in `public/` or packaged static) for consistent mix levels; **alternatively** a simple **Web Audio** bell/chime (oscillator) with **envelope** — must **stop** and **disconnect** the audio graph on dismiss / join / navigation. **No** autoplay of unrelated media. |
| **User control** | Expose a **setting** (e.g. `callJoinAlertSound` in user preferences or **local** toggle): **on** (default) / **off**; if **off**, **no** chime. Optional **volume** is **v1.1**; **v1** may be binary. |
| **OS / policy** | Honor **browser** autoplay rules: if the first play fails, **degrade** to **visual + optional `Notification` API** if permission was granted; **do not** retry sound in a tight loop. |
| **Visibility** | If `document.visibilityState === 'hidden'`, **do not** rely on sound alone: pair with **§1.2.2** and/or a **one-shot** `Notification` ("Space call" + **Join** action if feasible) when permission allows — **not** a substitute for the in-app modal when the user returns to the tab. |
| **Accessibility** | If sound plays, the **invitation** UI **shall** still **announce** via the **modal** title/description (`role="dialog"`, `aria-modal="true"`, `aria-labelledby` / `aria-describedby`). **Respect** user’s **reduced** preferences where applicable (no extra motion on the chime; sound opt-out is the primary a11y escape for sensory sensitivity). **Do not** play a second overlapping chime for every `ParticipantsChanged` tick. |

**1.2.2 Join invitation (modal “pop-up”)**

| Rule | Normative text |
| --- | --- |
| **Presentation** | A **modal dialog** (Radix **Dialog** / shadcn **AlertDialog** pattern) **on top of app chrome** — same **overlay** model as **§3.4.4** (viewport-level, not confined to the narrow sidebar). **Focus trap**; **Esc** closes; **Return** on open focuses **first primary** control. **Backdrop** optional for **invitation** (product may use **simpler** `AlertDialog` with scrim) — if backdrop click closes, document it (avoid accidental dismiss during mouse drag). |
| **Content** | **Title** — space-scoped, e.g. "Call in this space" / "Space call in progress". **Description** — **device count** and short explainer (space-wide, not thread-private). **Primary** — `enterAudio` (**Join with audio**). **Secondary** — `enterVideo` (**Join with video**). **Tertiary** / dismiss — **Not now** or **Close** (does not reject the call; user can still use **§3.2.1** strip). |
| **Relation to join strip** | The modal is **in addition to** the **join strip** — a **strong** interrupt for users not looking at the strip. After dismiss, the **strip** + toolbar copy remain. |
| **Throttling / re-open** | **Shall not** re-open the modal on every `ParticipantsChanged` (counts fluctuate). Suggested: open **once** when **`showRoomCallInProgress` flips** from **false → true** for a given `roomId`, or **first time in session** the user lands on a Space with an **active** call. Store a **dismissal key** in session state (e.g. `dismissedJoinInviteFor: roomId + groupCallId` or **per navigation session**). Re-show only if the call **ended and restarted** (idle count returns to 0, then is greater than 0 again) or a **new** product-defined **session** — document the chosen policy in the implementation PR. |
| **i18n** | All labels under **`HumanChatPanel`**, all locales. See **§3.7** (join invitation keys). |

**1.2.3 Traceability** — **IMP-10**; **audible** ring + strip: `packages/epics/.../use-call-join-chime.ts`; UI detail **§3.2.2**; test notes **§6** / **§7**.

**Implementation status:** **§1.2.1** — **Web Audio** chime (two-pair beeps, under about 3 s) with `localStorage` key **`hypha.callJoinAlertSound`**, a **Switch** on the **join strip**, and a per-room **dedupe** window to avoid **Strict Mode** or duplicate **false → true** edges; optional **`Notification`** (silent, if permission **granted**) when the document is **hidden** and a join **opportunity** is detected. **§1.2.2** (invitation modal) — not implemented.

---

## 2) Matrix integration (packages/core)

### 2.1 `createClient` options (`matrix-provider.tsx`)

**File:** `packages/core/src/matrix/client/providers/matrix-provider.tsx`

Extend `MatrixSdk.createClient({ ... })` with **explicit** VoIP-related options (do not rely on defaults alone—document intent in code):

| Option                     | Value (v1 recommendation)                                           | Rationale                                                    |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `disableVoip`              | `false`                                                             | Enable TURN fetch and VoIP stack.                            |
| `useE2eForGroupCall`       | `false` for `matrix-js-sdk@40.x`                                    | SDK v40 Rust crypto path throws `Unimplemented` for encrypted group-call to-device VoIP signaling; WebRTC media remains encrypted. |
| `useLivekitForGroupCalls`  | `false`                                                             | Native WebRTC via SDK for v1; LiveKit is a later epic.       |
| `forceTURN`                | `false` initially; expose env/feature flag if enterprise NAT issues | Stricter relay; test in staging.                             |
| `fallbackICEServerAllowed` | align with security review                                          | Only enable if HS provides no TURN and product approves.     |
| `iceCandidatePoolSize`     | `0` or small positive (e.g. `5`) per perf testing                   | Trade startup vs privacy/battery.                            |

**Do not** import `matrix-js-sdk` in Server Components; this file is already **`'use client'`**.

### 2.2 New context API: `SpaceCallController`

Expose a **narrow** API on `MatrixContextType` (same provider file) or a **dedicated** `React.Context` next to Matrix to avoid bloating `useMatrix()`:

**Recommended:** add `packages/core/src/matrix/client/hooks/use-space-group-call.ts` exporting:

- **`useSpaceGroupCall(roomId: string | null)`** returning:

| Field / method                   | Type                                                                                                        | Behavior                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `callState`                      | `'idle' \| 'initializing' \| 'awaiting_media' \| 'connecting' \| 'connected' \| 'disconnecting' \| 'error'` | Drives UI.                                                                                                       |
| `errorCode`                      | `null \| 'NO_CLIENT' \| 'NO_ROOM' \| 'NOT_READY' \| 'PERMISSION_DENIED' \| 'WEBRTC_FAILED' \| 'UNKNOWN'`    | Map to i18n.                                                                                                     |
| `threadContext`                  | `{ threadRootEventId: string } \| null`                                                                     | Set when user starts/joins from Signal UI.                                                                       |
| `enterAudio(threadRootEventId?)` | `Promise<void>`                                                                                             | `waitUntilRoomReadyForGroupCalls` → get/create `GroupCall` → `enter` with **audio** intent (mic on, camera off). |
| `enterVideo(threadRootEventId?)` | `Promise<void>`                                                                                             | Same with **video** (request camera + mic).                                                                      |
| `leave()`                        | `Promise<void>`                                                                                             | `GroupCall.leave` / cleanup; **stop all local tracks**.                                                          |
| `setMicrophoneMuted`             | `(muted: boolean) => Promise<void>`                                                                         | Delegate to `GroupCall` when connected.                                                                          |
| `setCameraMuted`                 | `(muted: boolean) => Promise<void>`                                                                         | Use SDK’s **`setLocalVideoMuted`** (or equivalent).                                                              |
| `setScreensharingEnabled`        | `(enabled: boolean) => Promise<void>`                                                                       | Delegates to **`GroupCall.setScreensharingEnabled`** — **v1.1+ UI** unless product promotes earlier (§3.7).      |
| `isScreensharing`                | `boolean`                                                                                                   | For toggle **pressed** state and stage layout.                                                                   |
| `localPreviewStream`             | `MediaStream \| null`                                                                                       | Optional: for local preview `<video>` (implementation detail).                                                   |
| `participantSummary`             | `{ count: number }` or SDK-derived                                                                          | For header badge.                                                                                                |
| `callKind`                       | `'audio' \| 'video' \| null`                                                                                | **`null`** when idle; drives **banner** (show/hide camera) and **stage** (§3.4).                                 |
| `roomGroupCallDeviceCount`       | `number`                                                                                                    | **Devices** in the room’s `GroupCall` while idle (from **§1.1** subscription) or in-session from `groupCall` — single source of truth for “how many in call”. |
| `othersInRoomCallCount`         | `number`                                                                                                    | In-session: `max(0, count − 1)`; idle: all devices (every device is an “other”). Drives **banner** and copy.     |
| `inCallUserIdsForRoster`         | `string[]` (Matrix `userId`s)                                                                               | Union of user ids with ≥1 device in `participants` — for **Members** tab hint (may be **fewer** than device count). |
| `showRoomCallInProgress`         | `boolean`                                                                                                    | `true` when **join** strip and **Join**-style toolbar copy **shall** show (§1.1 gate, §3.2.1).                 |

**Idle subscription:** Before local `enter`, the hook **shall** follow **§1.1** to keep `roomGroupCallDeviceCount` / `showRoomCallInProgress` **accurate**; otherwise two users can each “start” without seeing the other. After `enter`, the same `GroupCall` drives counts via in-session listeners.

**Matrix client usage (normative sequence):**

1. Guard: `if (!client || !roomId) return`.
2. `await client.waitUntilRoomReadyForGroupCalls(roomId)` (handle rejection → `NOT_READY`).
3. Resolve group call: use **`client.getGroupCallForRoom(roomId)`**; if **null**, **`client.createGroupCall(...)`** with types from **`GroupCallType`** / **`GroupCallIntent`** per [matrix-js-sdk](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html) — align **audio vs video** with product (Element Web is the reference for argument ordering).
4. `await groupCall.enter()` after local media where required.
5. Subscribe to **`GroupCall`** / **`CallEvent`** listeners for connection failures → `WEBRTC_FAILED`.
6. On unmount or `leave()`, remove listeners, **terminate** or **leave** per SDK contract, and **revoke media tracks**.

**Idempotency:** If user taps **Audio** twice, second tap should **no-op** or **join** same session—no duplicate `GroupCall` instances for the same `roomId`.

### 2.3 Optional thread timeline notice

**If** product enables FR-5 (parent doc): add **`sendThreadCallNotice(roomId, threadRootEventId, body)`** using existing thread send pattern (`m.relates_to` with `rel_type: m.thread`) — mirror **`sendMessage`** thread logic from matrix engineer role / `sendEvent` helpers. **Gate** behind a boolean `postThreadCallNoticeOnCallStart` in config or constant for v1.

### 2.4 `GroupCall` in-call capabilities (matrix-js-sdk v40)

The spec below maps **[`GroupCall`](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html)** methods and feeds to product/UI. Implementers SHALL verify exact signatures in the installed SDK.

| SDK surface                                                                          | Purpose                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **`setMicrophoneMuted` / `isMicrophoneMuted`**                                       | Local mic mute.                                                          |
| **`setLocalVideoMuted` / `isLocalVideoMuted`**                                       | Local camera off (distinct from leaving call).                           |
| **`setScreensharingEnabled(enabled, opts?)` / `isScreensharing`**                    | **Screen share** (browser `getDisplayMedia` path inside SDK).            |
| **`updateLocalUsermediaStream(stream)`**                                             | Replace local A/V stream (advanced).                                     |
| **`getLocalFeeds`**, **`userMediaFeeds`**, **`screenshareFeeds`**                    | **`CallFeed`** instances for rendering `<video>` / audio elements.       |
| **`getUserMediaFeed(userId, deviceId)`**, **`getScreenshareFeed(userId, deviceId)`** | Per-participant feed lookup for tiles.                                   |
| **`participants`**                                                                   | Map of **`RoomMember`** → devices → participant info.                    |
| **`terminate`**, **`leave`**                                                         | End session for room / local participant.                                |
| **`activeSpeaker`** (optional)                                                       | Highlight dominant speaker if SDK exposes (see accessor on `GroupCall`). |
| **`getGroupCallStats` / `setGroupCallStatsInterval`**                                | Optional quality/debug UI (not required for v1).                         |
| **PTT** (`isPtt`, `pttMaxTransmitTime`, etc.)                                        | Push-to-talk mode — **optional** product; not in baseline v1 UI.         |
| **`on` / `GroupCall` events**                                                        | React to participant join/leave, feed updates — drive stage re-render.   |

**Not on `GroupCall` (use `MatrixClient` elsewhere):** **`supportsCallTransfer`**, **`setSupportsCallTransfer`** — **1:1 call transfer**; **out of scope** for baseline **group** Space call unless product adds 1:1 flows later.

---

## 3) UI integration (packages/epics)

### 3.1 Target layout (aligned with design mock)

The Signal / thread panel SHALL use a **stacked header** inside `SidebarHeader` (or equivalent), **top to bottom**:

1. **Context strip (optional)** — One or two lines: Signal title and/or short description (e.g. coordination copy). Uses existing typography (`text-xs`, `text-muted-foreground`, `line-clamp-*`). May reuse fields from coherence/Signal metadata when available.
2. **Navigation + actions row** — **Single horizontal row**, full width:
   - **Left:** `HumanChatPanelTabs` — **Chat** | **Members** | **Pins** (add **Pins** when that epic lands; until then **Chat** | **Members** only is acceptable if product agrees).
   - **Right:** **Icon group** (outline style, dark theme): **Phone** (audio), **Video**, **Search** — same visual weight and spacing as the mock.
3. **Active-call banner** — Only when `callState` is `connecting` | `connected` | `disconnecting` (see §3.3). Sits **directly under** the navigation row, **above** `SidebarContent`.
4. **Main content** — `SidebarContent`: chat list, members list, or pins per tab; **call stage** overlays or shares the top of this area during an active **video** call (see §3.4).

**ASCII wireframe (structure only):**

```text
┌─────────────────────────────────────────────────────────────┐
│ [optional description / signal context line-clamp]            │
├─────────────────────────────────────────────────────────────┤
│  (Chat) (Members) (Pins)          [phone] [video] [search]   │
├─────────────────────────────────────────────────────────────┤
│  Space call · 02:14     [Mute] [Camera] [Leave]  (spinner)  │  ← banner when in call
├─────────────────────────────────────────────────────────────┤
│  ┌─ call stage (video) ────────────────────────┐            │
│  │  remote tiles + local PiP                     │  OR  msg  │
│  └──────────────────────────────────────────────┘            │
│  … messages …                                                │
└─────────────────────────────────────────────────────────────┘
```

**File:** `packages/epics/src/common/human-right-panel.tsx` wires layout; presentational pieces live under `human-chat-panel/`.

#### 3.1.1 Tab row + call toolbar / settings — **overlap and clipping (normative)**

**Symptom to prevent:** In a **narrow** right panel, the **active** tab (green border / accent chrome) and/or a **clipped** tab label (e.g. only **“M”** visible for **Mentions**) appears to **run under** the **phone / video / search** cluster or the **settings** icon, or the tab text is **illegible** with no clear scroll affordance.

**Root cause (typical):** A single `flex` row where the **tab `tablist`** and the **call `tabRowEnd`** (notification **settings** live in the **top** header next to the **bell**, not in this row) all compete for width. The scrollable region (`overflow-x-auto` + `flex-1` + `min-w-0`) can shrink the **inner** width of a tab so aggressively that the **label truncates per-character**; the user reads overlap where it is really **clipping** inside the tab, adjacent to a **fixed** icon group.

**Proposed implementation rules (pick one pattern and document in the PR; all satisfy the AC below):**

| #  | Rule |
| -- | ---- |
| R1 | **Reserved width for the right cluster:** The combined **call toolbar** (`tabRowEnd`) and **settings** `Link` SHALL be **`shrink-0`** (or `flex-none`) so they **never** compress. Icon buttons keep a **fixed** footprint (e.g. `h-7` + square hit targets) matching **`human-chat-panel-call-toolbar.tsx`**. |
| R2 | **Tab rail is the flexible region:** The **`role="tablist"`** region SHALL sit in a **separate** flex or grid track with **`min-w-0`** so it may scroll horizontally, but **MUST NOT** be given layout rules that let **individual tab buttons** shrink below a **minimum readable** width (see AC). |
| R3 | **No accidental overlap (stacking):** Tab **`<button>`**s and the right cluster SHALL share one row **without** `z-index` “fixes” on tabs that would paint **above** the call icons. If layering is ever needed, use a **subtle** separator (e.g. `border-s` on the end cluster) and ensure backgrounds are **opaque** on the icon group — not higher `z-index` on the tab list. |
| R4 | **Active tab chrome:** The selected tab’s **border / ring** (e.g. `ring-inset`) **MUST** stay **inside** the button’s **border box** — no `outline-offset` or shadow that extends **into** the icon column. |
| R5 | **Optional more robust row model:** Use **CSS `grid`** with explicit columns, for example: column 1 = `1fr` (scrollable `tablist` with `min-w-0`); columns 2 and 3 = `auto` for `tabRowEnd` and settings, using **`minmax(0, max-content)`** or `auto` plus `shrink-0`. This avoids `flex-1` ambiguity between siblings. |
| R6 | **Narrowest panel:** If product defines a **minimum** chat panel width, verify this row at that width in **en** and the longest locale; if labels still do not fit, the **`tablist`** **horizontal scroll** SHALL remain the **only** overflow (fade or scrollbar **not** hidden in a way that confuses — current `[scrollbar-width:none]` is acceptable if **swipe/scroll** still works on touch; desktop may show a thin scrollbar on focus). |

**Acceptance criteria (manual + visual):**

- [ ] At a **realistic minimum** right-panel width, **Mentions** (and **Members**) show **at least the full short label** **or** a **documented** abbreviated label (e.g. `title` + tooltip) — **not** a single mystery letter.
- [ ] The **active** tab’s **accent border** does **not** sit **on top of** the call or settings icons; **no** more than **hairline** optical collision.
- [ ] **Focus order** remains: … last tab → **first call icon** → … → **settings** (or as agreed for RTL).

**Files:** `packages/epics/.../human-chat-panel-tabs.tsx` (row layout, `tabRowEnd`); `human-chat-panel-call-toolbar.tsx` (fixed icon sizing).

**Status (implemented in codebase):** `HumanChatPanelTabs` uses **`grid` `minmax(0,1fr) | auto`**, a **scrollable** tab rail (outer `overflow-x-auto` + inner `inline-flex w-max` so tab buttons are not width-crushed), opaque **`bg-background` + `border-s`** on the end cluster, and **thin** horizontal scrollbar instead of fully hidden. Tab label `truncate` + `title` is a last resort for extreme overflow.

### 3.2 Idle state — header icons (phone, video, search)

**Component:** `human-chat-panel-call-toolbar.tsx` (or a merged row component that renders **tabs + icons** in one flex row).

| Control    | Idle behavior                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phone**  | Starts **join** with **audio only** (`enterAudio`).                                                                                                                                                            |
| **Video**  | Starts **join** with **camera + mic** (`enterVideo`).                                                                                                                                                          |
| **Search** | **In-scope for v1:** wire `onSearchClick` to **in-thread / in-space search** when the search epic exists; until then **stub** with tooltip “Coming soon” or `aria-disabled` — **do not** block VoIP on search. |

**States:**

- **`callState === 'idle'`:** Icons **enabled** when Matrix + `roomId` are ready.
- **`callState` in `initializing` | `awaiting_media` | `connecting`:** Phone + Video show **loading** and are **non-interactive** to prevent double-join.
- **`callState` in our session (from `enter` through `connected` to `disconnecting`):** The **header** phone/video control that matches **`callKind`** **shall** use a **visible** “active” style (e.g. **accent** border + **tinted** background) so the user can see they are in an **audio** vs **video** call before and after `connected`. **`aria-pressed`** **shall** follow the same rule.

**Props (normative minimum):**

```typescript
type HumanChatPanelCallToolbarProps = {
  callState: SpaceCallState; // from useSpaceGroupCall
  threadRootEventId: string | null;
  disabled?: boolean;
  onAudioClick: () => void;
  onVideoClick: () => void;
  onSearchClick?: () => void;
};
```

**Accessibility:** `aria-label` per icon; live region for **joined** / **left** call; focus order: tabs → phone → video → search → banner controls.

#### 3.2.1 **Join** affordance (call in progress while **you** are **idle**)

**Normative (see §1.1):** When `showRoomCallInProgress` is true, the panel **shall** surface a **space-wide** “call in progress” message and **Join** actions so a second user does not assume they must “start a new call.”

| Surface | Requirement |
| -------- | ------------ |
| **Join strip** | **`HumanChatPanelCallJoinStrip`**: placed **immediately under** the tab + toolbar row (above **3.3** when both apply). Shows **title** + **member** count; **Join call \| In progress** calls `enterAudio` (same path as **§3.2**). **Call ring** mute is on the **mention bell** (long-press), not a second icon. **`role="status"`**, `aria-live="polite"`. **Disabled** when `busy` (connecting) or panel/room not ready. |
| **Header toolbar** | When others are in the room call, **phone** and **video** `title` / `aria-label` **shall** use **Join audio** / **Join video** copy (i18n), not only “Start…”, so the affordance is visible **without** scrolling to the strip. |
| **Members tab** | When the local user is **not** in the session, **shall** show a short **hint** that a call is active in the space; when **in** the session, **may** list **Matrix `userId`s** from `inCallUserIdsForRoster` for debugging / clarity (user count ≤ device count). |
| **Banner (in call)** | Uses `roomGroupCallDeviceCount` and `othersInRoomCallCount` for “you are in this space’s call” + “others” copy (§1.1, §3.3). |

**Rationale for subscription:** If the client only subscribes to `GroupCall` **after** local `enter`, the UI shows **0 others** while idle and each user can create/join a **separate** perceived session. The **§1.1** idle listener fixes that for **v1**.

#### 3.2.2 Join **invitation** modal and **ring** (spec — **IMP-10**)

**Normative (see §1.2):** **Ring (§1.2.1):** `HumanRightPanel` wires **`useCallJoinChime`**; **mute** for join chime is toggled by **long-press** on **`HumanChatPanelMentionBell`** (when join strip is relevant), persisting to **`hypha.callJoinAlertSound`**. If the **tab** is **hidden** and the browser has **`Notification` permission** (`granted`), a **silent** one-shot notification is shown. **Modal invitation (§1.2.2):** **TBD**. **Throttling** (when added) must prevent re-open on every `ParticipantsChanged`.

**Files (as shipped for ring):** `packages/epics/.../human-chat-panel/use-call-join-chime.ts`, `human-chat-panel-call-join-strip.tsx`, `human-right-panel.tsx`. A static **audio** asset is **not** used (avoids extra CSP for now).

**Do not** combine this with **in-call** **full view** (**§3.4.4**): the join invitation is **pre-join** only; never stack two competing modals.

### 3.3 Active-call banner (space-wide + primary controls)

**Component:** `human-chat-panel-call-banner.tsx`

**Placement:** Immediately **below** the Chat / Members / Pins + icons row, **above** `SidebarContent` (or above the split **stage + messages** region when video is active).

| Element        | Requirement                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Label**      | **Must** indicate a **space** call (e.g. “Space call”, “Call in this space”) — not “Signal-only”. Optional: **participant count**.                                    |
| **Timer**      | **Optional v1.1:** `mm:ss` since connected; otherwise show **Connecting…** / **Connected**.                                                                           |
| **Mute**       | Toggles mic; reflects `GroupCall` state.                                                                                                                              |
| **Camera**     | Toggle video mute / camera off. **Hide** when session is **audio-only** (`callKind === 'audio'`) or show **disabled** — choose one and document in implementation PR. |
| **Leave**      | Primary **end call** control: **circular** (same diameter as other primary controls in the strip), **filled** destructive color, **phone-hang-up** style icon (e.g. `PhoneOff`); **no** wide “pill + text” in the **banner** or **full view** — `aria-label` + `title` carry “Leave” for screen readers. Implemented in **`HumanChatPanelInCallControls`**. |
| **Connecting** | Spinner + disabled primary controls until `connected`.                                                                                                                |

**Errors:** If `callState === 'error'`, show compact message with optional **Retry** / **Dismiss**.

### 3.4 During-call — audio vs video (main panel)

#### 3.4.1 Audio-only (`enterAudio`, camera off)

- **In-panel and full view:** The call **stage** is **not** optional — it **shall** show the **minimum frame** (§3.4.1): **avatar** (Matrix / Hypha profile) + **name** + **waveform** when speaking, for each **user media** `CallFeed` (see `HumanChatPanelCallStage` + `getHumanChatPanelCallStageModel` — **do not** return `kind: 'hidden'` for **solo** **audio** or **video with camera off** when the local feed exists).
- **Chat tab:** Message list **below** the stage; banner stays at **top** of panel while scrolling.
- **No video track (audio-only or camera off):** For each **user media** `CallFeed` tile with **no** visible video, the stage **shall** show a **plain** dark **fill** (no camera frame), the participant **name** (or “You” for local PiP), and — **only** when `CallFeed` reports **speaking** via **`isSpeaking()`** / `CallFeedEvent.Speaking` (and **not** when audio is muted) — a **bar waveform** in the same **visual language** as **in-chat voice message** rows (`CallAudioVoiceWaves` / `call-audio-voice-waves.tsx`). **Voice messages** in the timeline use the **same** bar look; while **playing**, `ChatVoiceAudioRow` **shall** drive bar **height** from **Web Audio** `AnalyserNode` **frequency** data (not a fixed loop) when the track is **same-origin** CORS–safe; **idle** = static silhouette; **`prefers-reduced-motion`**: no live analysis loop, mid-height pattern while playing. Bars **must** be **static** (muted) for in-call tiles when the participant is not speaking.

#### 3.4.2 Video (`enterVideo` or camera on after join)

**Component:** `human-chat-panel-call-stage.tsx`

- When `activeTab === 'chat'` and `callState === 'connected'` and **video is active** (local or remote):
  - **Top** of `SidebarContent`: **stage** with **remote** participant tiles (from SDK feeds) and **local** preview as **picture-in-picture** in a **corner** (e.g. bottom-end) so tabs/header stay unobstructed.
  - **Below** stage: **scrollable** message list (split view). **Min-height** for stage (e.g. `min-h-[220px]` or ~40% panel height) — tune with design.
- **Camera off (video muted):** **Do not** remove the stage — **same** **minimum** **audio** **tile** (avatar, name, waves) as **§3.4.1**; **keep** banner controls. **No** `hidden` stage for **solo** **in-call** user with `localUserMedia` **feeds** present.
- **Widening the panel (one remote tile + PiP):** When the **user-media** grid has **one** main tile, it **shall** span the **full width** of the **stage** — **one** `grid` column (no `max-w-2xl` / horizontal centering that leaves empty space) so **resizing the right panel** grows the **video** with the available width. Two or more **main** user tiles may use **responsive 2–3** column rules at **container** breakpoints.
- **2+ user tiles (mixed avatar and video):** In the **side panel**, each **grid** cell for user media **shall** have the **same** **minimum** **row** **height**; **video** `CallFeed` tiles **shall** **fill** the **cell** (`h-full` / `object-cover`) and **not** use a **lower** `max-h` than the **avatar** **+** **waves** column — **avoid** a **“postage stamp”** **video** beside a **taller** **avatar** **row**.

#### 3.4.3 Tab switching during a call

- **Members** / **Pins:** Banner **stays visible**; call continues in background.
- **Chat:** Stage + messages as **§3.4.2** when video active.

**IMP:** Panel unmount or leaving Space **must** `leave()` and release `MediaStream` tracks.

#### 3.4.4 Full view (enlarged call stage — **modal**)

**Problem:** The in-panel **call stage** is **narrow** (right sidebar). Users need a **larger** view of **shared screen** and **camera** tiles for review, demos, and legibility without changing the underlying `GroupCall` / WebRTC model.

**Normative product behavior**

| Topic                            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**                      | A **tertiary** control: **“Full view”** (icon: **expand / maximize** — e.g. Lucide `Maximize2` or equivalent; **not** the browser **Fullscreen API** _unless_ product explicitly requests it later). The control is visible whenever `canOpenHumanChatCallFullView` is **true** (stage **`kind === 'main'`**): **connected** call with **at least** the **minimum** **avatar**/**audio** **frame** — **including** **audio-only** and **video with camera off** (not only when **live** **video** **tracks** exist). **Hidden** when the stage would not mount (e.g. not **connected**, or no **user-media** **feeds**).                                                                  |
| **Presentation**                 | Opening **Full view** SHALL render a **modal dialog** (Radix `Dialog` or shadcn `Dialog`) **on top of the app chrome** (viewport overlay), **not** only the sidebar. **Backdrop** semi-opaque; **click on backdrop** closes the modal (same as **Close**). This is **app-level modal** UX — it does _not_ replace the Matrix `GroupCall` or duplicate feeds in a second React tree: **reuse the same** `<video>` / `CallFeed` **streams** the stage already uses (or **lift** a single “stage content” sub-tree) so **media** is not double-attached.                                                                           |
| **Content**                      | The modal **body** replicates **or composes the same** layout as the **in-panel** stage: **screen-share** tiles (when present) remain **primary**; **user media** grid + **local PiP** follow **§3.5** ordering. **No** new Matrix APIs — pure UI.                                                                                                                                                                                                                                                                                                                                                                              |
| **Size**                         | Modal **max** dimensions: e.g. **`max-w-[min(96vw,80rem)]`**, **`max-h-[min(90dvh,900px)]`** (tune in implementation); **scroll** inside the modal if tile count or aspect ratio exceeds the box — **no** loss of the leave path (see a11y).                                                                                                                                                                                                                                                                                                                                                                                    |
| **In-modal controls**            | The modal SHALL surface the **same in-call primary controls** as the call banner: **mic**, **camera** (when `callKind === 'video'`), **screen share**, and **Leave**, driven by the same `useSpaceGroupCall` actions so behavior matches the **sidebar** strip. A **dedicated** toolbar row in the **modal** is acceptable; controls **must** remain operable with the **modal** open.                                                                                                                                                                                                                                          |
| **Layout / fill**                | The **call stage** in full view SHALL use a **column flex** layout: **header** (title) → **fill area** (tiles + `object-contain` video) → optional **error strip** → **control** row. The fill area SHALL use **`min-h-0`** and **`h-full` / `flex-1`** so at least the **dominant** tile (screen share or single video) can grow to the **available** height, not a **fixed small** `max-h` left over from the sidebar stage.                                                                                                                                                                                                  |
| **Close**                        | **Primary** dismiss: **X** (or “Close full view”) button, **Esc** key, and **backdrop** click. Closing **only** leaves the **modal**; the **call** stays **connected**; user returns to the **sidebar** stage.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **State**                        | **Local** React state: `isCallFullViewOpen: boolean`. **Initial:** `false` on connect. If the user **leaves the call** or the **panel unmounts** while the modal is open, close the modal in the same cleanup path that runs **`leave()`** (defensive). **Tab** switch (**Members** / **Pins**): keep modal open **if and only if** the stage would still be shown under current rules; **if** the stage is hidden (e.g. no video path on a tab with no stage), **close** the modal or show an empty state — **prefer** closing the modal to avoid a floating empty dialog (document the chosen rule in the implementation PR). |
| **Primary image (large & neat)** | See **§3.4.4.1** — the user-visible goal is a **neat, large** image of the call in the **fill area** (between title and control bar), **not** a small tile, **not** a narrow column, **not** a large **empty** region beside the main picture.                                                                                                                                                                                                                                                                                                                                                                                  |

##### 3.4.4.1 Full view — **primary stage** and **sizing** (normative; fixes “small video + empty void”)

**User-visible defect to reject:** A **main** video or screen image appears in a **narrow** band (e.g. ~30% of modal width), the **rest** of the width is **unused black**, and/or the **image** is a **“postage stamp”** inside a **tall** inner box (heavy letterboxing) while a large black area to the right stays **empty** — i.e. the **stage** is not a **maximized** canvas, only the **&lt;video&gt;** is `object-contain` inside a **left-aligned** or **constrained** tile that does **not** use the available space.

| ID       | Normative rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FV-0** | **Mode separation:** The **in-panel** stage (§3.4.2, §3.5) and the **full-view** stage (modal) **MUST** be different **layout modes** in CSS/React even if they share the same `CallFeed` / `&lt;video&gt;` **data**. **Full view SHALL NOT** re-use, without change, the **same** `grid` + **`max-w-*` centering** + **sidebar** `min-h` / `max-h` on tiles that were tuned for a **~320px** wide panel. Implementations **MUST** document the **`layout=fullView`** (or equivalent) class tree that applies only in the modal.                                                        |
| **FV-1** | **No dead second column:** Between the **dialog** header and the **control** bar, the **dominant** media (see §3.5 priority: **screen share** if any, else **agreed** primary camera) **MUST** live in a **single** “main stage” sub-region that is **100% of the** **fill area** **width** (allow small horizontal `px-n` **padding** only, not a **layout** that allocates ~30% to video and **~70% to nothing**).                                                                                                                                                                    |
| **FV-2** | **Box fills, then &lt;video&gt; fits:** The **containing** element for the dominant **feed** (the tile **wrapper** around the `&lt;video&gt;` or avatar) **MUST** have **`min-height: 0`**, **`flex: 1 1 0%`** (or `flex-1` in a `min-h-0` column) and **`width: 100%`** of the main stage, so the **box** is **large** first. Only **inside** that **full** box, **`object-contain`**, **`object-cover`**, or **`min()` height** is applied. **Anti-pattern:** a **small** flex child with a **large** empty **sibling** taking **flex-1** — the **empty** **sibling must not** exist. |
| **FV-3** | **Object-fit policy:** **`object-contain` on the &lt;video&gt;** is **allowed** (no hard crop) **provided** the **containing** box (FV-2) is already **as large** as the fill area: letterboxing, if any, is **only** to preserve **aspect** inside a **nearly full-bleed** **dark** canvas, **not** a **tiny** **frame** floating in a **bigger** black void. If product **prefers** a **filler** “hero” look with minor edge crop, **`object-cover` may** be used for the **dominant** camera (optional); document the choice.                                                        |
| **FV-4** | **PiP:** The **local** / secondary **PiP** **MUST** **float** on **top of** the **dominant** stage (absolute / overlay), **or** the layout **MUST** clearly partition **e.g. 80/20** for **side-by-side** where **both** regions are **intentional** and **not** a **blank** half. **Not allowed:** two-column flex where column one is a **shrink-0** narrow tile and column two is an **unfilled** **flex-1** black void.                                                                                                                                                             |
| **FV-5** | **Multi-participant:** When there are **multiple** **remote** tiles, the **main stage** **MAY** be a **scrollable** **grid** of **equally** weighted cells that **tessellate** the **fill** area, **or** a **one-row** / **masonry** pattern — **MUST** avoid a **ragged** “one tile + empty desert” when **N = 1** (see FV-1 / FV-2). If **screen share** + **camera** grid, **screen share** gets the **largest** continuous rectangle per §3.5; the **user-media** band **MUST** use the **rest** of the **height/width** without a **huge** **unused** **margin**.                  |
| **FV-6** | **Engineering check:** The implementation **PR** **MUST** attach a **before/after** **screenshot** of **2-party** test (no share, both video on) and **1-party** with **screen share** at a **~1280px** viewport, **demonstrating** the **dominant** frame **touches** both the **left** and **right** **edges** of the **main** stage (except intentional **padding**). A **~30% / 70%** **empty** split (as in common defect reports) **fails** review until resolved.                                                                                                                |

**Rationale (non-normative):** Sidebar and modal share **one** `GroupCall`, but the **UI** is different: a **condensed** grid in the **panel** vs. a **hero** main surface in the modal. Re-applying the **grid** that centers **`max-w-2xl`** or leaves unassigned `grid-cols` tracks in **full view** reproduces the narrow-tile + void bug; FV-1–FV-2 name the required **“main stage = full width”** contract explicitly.

**Status (implemented in codebase):** `layout=fullView` uses: **(1)** **single** remote (or local solo) camera with **no** `grid` — **flex** column with **`flex-1`**, **`absolute inset-0`** video in tile (`FeedContent`); **(2)** `grid-cols-2` at `sm+` only when there are **≥2** user tiles, else **`grid-cols-1`**; **(3)** screen share blocks **`flex-1`**, camera strip below with **`max-h` cap**; **(4)** screen share tile wrapper **`flex-1` flex-col`**. PR screenshot per **FV-6** is still a **product** / review artifact. **Follow-up (normative, see §3.4.4.2–§3.4.4.3):** screen share **must** consume **all** of the main stage **except** an **explicit** thumbnail / filmstrip reserve; user-selectable **layout modes** (Zoom-like) and **icon contrast** on the modal control bar (§3.4.4.4).

##### 3.4.4.2 Screen share + camera — **real estate** in **full view** (normative)

**Reference UX:** [Zoom’s screen sharing layouts](https://support.zoom.com/hc/en/article/201362153-Sharing-a-screen) — *speakers can appear beside or on top of shared content; participants can change layout.* Hypha is **not** required to copy Zoom pixel-for-pixel; the spec **does** require the **same class of control**: **one dominant surface** (the share) **plus** a **non-wasteful** region for **participants**, without **huge** black voids beside a **postage-stamp** share (see FV-1, FV-2).

| ID | Normative rule |
| --- | --- |
| **SS-1** | When **at least one** `screenshareFeeds` item is **visible** in **full view**, the **shared screen** (dominant `CallFeed` / `&lt;video&gt;`) **SHALL** be laid out in a **container** that is **`flex-1` `min-h-0`** in the **fill area** and **`width: 100%`**, so the **stage canvas** (dark background) is **filled** by the **combination** of (a) the **share** and (b) the **participant video** affordance, **not** a **small** share with **60%+** of the **width** or **height** unused. |
| **SS-2** | **Reserved band for video:** A **dedicated** sub-layout (see §3.4.4.3) **SHALL** allocate space for **participant** tiles (thumbnails, filmstrip, or overlay) using **explicit** CSS (e.g. a **row** with **`min-h-[…]`** / **`max-h-[…]`**, or a **grid track**, or **overlay** `inset`); **MUST NOT** leave **unlabeled** “dead” `flex-1` siblings that read as **empty** black. |
| **SS-3** | **`object-contain`** on the **share** `&lt;video&gt;` **MAY** letterbox **inside** the share’s **own** tile box (preserve aspect) **only if** that tile box already **takes** the **intended** fraction of the stage (per **SS-1** and the **selected layout mode**). **Not allowed:** a **tiny** `max-w-*` share tile centered in a **huge** unused canvas when **layout mode** expects **side-by-side** or **top + bottom**. |
| **SS-4** | The **in-panel** stage (sidebar) **MAY** keep a **simpler** default; **full view** **MUST** satisfy **SS-1**–**SS-3** when the user opens the modal while screen share is active. |
| **SS-5** | **Draggable split:** In **full view**, when **layout mode** uses a **visible** **boundary** between **screen share** and **participants** (side-by-side, filmstrip, speaker-on-top), the UI **SHALL** provide a **draggable** **splitter** (high-contrast handle, e.g. emerald) so the user can **adjust** the **relative** **flex** **fraction**; **MUST** **persist** the ratio per **mode** in **`localStorage`** (`hypha.callFullView.split.sideBySide`, `…filmstrip`, `…speakerOnTop`); **MUST** expose **`aria-label`** / **keyboard** (arrow keys) on the **separator**. |

**Acceptance (visual):** For **1** remote (or local) **screen share** + **1** user-media tile, capture **screenshots** at **~1280×800** and **~1920×1000** showing: **no** “hall of mirrors”-scale **framing** bug (share is **visibly** the **primary** surface; thumbnails are **clearly** in the **designated** band, not an accident of empty space).

##### 3.4.4.3 **Layout mode** (Zoom-style) — user choice (normative, full view)

**Product goal:** The user can **arrange** how **cameras** relate to **screen share**, similar in **spirit** to Zoom’s **“side-by-side mode / speaker on top / hide thumbnails”** style controls — without changing `GroupCall` or feed wiring.

| Topic | Normative text |
| --- | --- |
| **Where** | A **layout** control is **SHALL** appear in the **full view** dialog (toolbar row near **Close**, or a **`DropdownMenu`** / **segmented** control) **when** `screenshareFeeds.length +` relevant user tiles implies **share + at least one** camera. **MAY** be **hidden** when there is **no** screen share (only gallery video) — **then** the stage follows **§3.5** / FV-5. |
| **Default** | **Side-by-side main** (see below): **Share** uses the **largest** continuous rectangle; **user-media** appears in a **secondary** region (**filmstrip** below, or **column** to the right at **`@media (min-width: …)`**). This **MUST** be the **initial** mode when the user opens full view with share active, unless **persisted** user preference (optional) says otherwise. |
| **Mode A — “Filmstrip” (default)** | **Share: top / main** (`flex-1`), **participants: bottom** strip with **horizontal** scroll if needed. **Min** strip height (product: e.g. **88–120px**) to keep faces legible. |
| **Mode B — “Share left / people right”** | On **wide** viewports, **split** the fill area: **share ~65–80%** width, **user-media column** (stacked tiles) for the **rest**. **MUST** define a **breakpoint**; below it, **fall back** to Mode A or a compact two-row layout. |
| **Mode C — “Speaker / primary on top”** | The **active speaker** (or **pinned** feed, if product adds pin later) **large** tile **above** the **share**; **share** fills **remaining** **height** — *Zoom “speaker on top of shared content”* analog. **If** the SDK’s **active speaker** is **unreliable**, **MUST** document **fallback** (e.g. first remote **camera** tile). |
| **Mode D — “Video on content” (PiP / overlay)** | One or more **camera** tiles as **overlays** on the **share** (default **bottom-end**; optional **user** corner selector **later**). **MUST** avoid **hiding** critical **share** UI; **MUST** keep **z-index** so controls (§3.4.4.4) stay **above** these tiles. |
| **State** | Selected mode **SHALL** live in **React** state (full view). **MAY** persist in **`localStorage`** as `hypha.callFullViewLayoutMode` (string enum) for **return visits**. **MUST** reset to **default** on **new** full view open **if** product decides **session-only** — **document** the choice. |
| **a11y** | The **layout** trigger **MUST** have **`aria-label`** (i18n), **keyboard** access, and a **description** in the **dialog** or **menu** entry for each option. |
| **i18n** | New keys (example names): `callLayoutMode`, `callLayoutFilmstrip`, `callLayoutSideBySide`, `callLayoutSpeakerOnTop`, `callLayoutPip` — all locales. |

**Out of scope for v1.0 of this spec item:** **Browser** native `requestFullscreen` on the share `&lt;video&gt;` only; **multi-screen** picker; **separate** window pop-out. **MAY** be a follow-up ADR.

##### 3.4.4.4 **In-modal** call **controls** — **icon** visibility (normative)

**Problem:** Circular buttons use **dark** (e.g. `zinc-900/85`) or **accent** (green) backgrounds; **outline** icons with **low-contrast** stroke (dark-on-dark) **fail** visual verification and **WCAG** non-text contrast where applicable.

| ID | Normative rule |
| --- | --- |
| **IC-1** | For `variant=fullView` in **`HumanChatPanelInCallControls`**, **mic**, **camera**, and **screen share** **icons** (Lucide or custom) **SHALL** use **`className` / `stroke` such that the glyph renders as** **white** or **near-white** (`#fff` or **&gt;3:1** against the button **fill** for **default** and **active** (green) **states**). **Forbidden:** `currentColor` resolving to **near-black** on `bg-zinc-900/85` or `bg-accent-*`. |
| **IC-2** | The **end call** (destructive) button **SHALL** keep a **white** (or `destructive-foreground`) **icon** on **`bg-destructive`**, with **stroke width** ≥ the **default** for **legibility** at `h-10` / `h-11` touch sizes. **Custom** SVGs (e.g. hang-up handset) **MUST** use the same **contrast** rule. |
| **IC-3** | **Focus / disabled:** When **`disabled`**, **SHALL** reduce **opacity** of the **entire** button, **not** only the icon (avoids “invisible” glyph with active-looking chrome). **Focus ring** **SHALL** remain **visible** on the **control**, not the icon alone. |
| **IC-4** | The **in-banner** strip (`variant=inBanner`, light background) **MAY** use **theme** `text-foreground` for icons; **MUST** verify both themes (light **and** **dark** panel) in QA. If **banner** and **full view** diverge, **document** in the component with a short comment. |

**QA matrix:** Full view, **light** and **dark** app theme, **all four** control types (mic on/off, cam on/off, share on/off, leave) — **no** “missing” or **&lt;3:1** **glyph** on **default** and **active** (green) **backgrounds**.

**Accessibility (WCAG-aligned, normative minimum)**

- **`role="dialog"`**, `aria-modal="true"`; **`aria-labelledby`** pointing to the dialog title (e.g. “Call — full view” / i18n).
- **Focus trap** inside the modal while open: **first** focus to the **close** control or a **container**; **Tab** / **Shift+Tab** do not escape until closed; **Esc** closes and **returns** focus to the **element** that opened the dialog (`aria-haspopup` / `aria-expanded` on the trigger is recommended).
- **`aria-hidden`** (or inert) on the **page behind** the dialog per the design-system pattern used elsewhere.
- **Reduced motion:** no gratuitous open/close **animation** on the modal, or use **`prefers-reduced-motion`** to shorten/disable.

**Matrix / WebRTC (engineer contract)**

- **No** change to `GroupCall.enter` / `leave` / feed subscriptions for this feature.
- **Video elements:** Re-parenting the **same** DOM for `<video>` can disconnect playback in some browsers; **reference implementation** either (a) **portal** the existing stage **node** into the modal while open, or (b) use **a single** stage renderer with **layout props** (variant `panel` \| `modal`) so **one** set of `srcObject` attachments exists. The implementation PR **must** document the chosen approach and **verify** no **double** audio (duplicate `<audio>` or unmuted **parallel** `HTMLMediaElement`).

**i18n:** see **§3.7** (`callFullView`, `callFullViewClose`).

### 3.5 In-call layout: all `GroupCall` media types (video, screen share, …)

The **call stage** (`human-chat-panel-call-stage.tsx`) SHALL render feeds from **`userMediaFeeds`** and **`screenshareFeeds`** (and **`getUserMediaFeed` / `getScreenshareFeed`** as needed), not only “camera video”:

| Feed type                 | Source (conceptual)           | UI treatment                                                                                                                                                                           |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Remote / local camera** | `userMediaFeeds` / `CallFeed` | Tile in grid; local as **PiP** overlay.                                                                                                                                                |
| **Screen share**          | `screenshareFeeds`            | **Dedicated tile** (often large aspect ratio); may **replace** or **split** grid with camera tiles (product: **prefer prominent screen tile** when `isScreensharing` local or remote). |
| **Audio-only**            | Audio tracks on feeds         | **Avatar / initials** tile when no video track; still show **speaking** indicator if available.                                                                                        |

**Screen share control:** **`setScreensharingEnabled`** — button in **banner** (next to camera) or overflow menu; **icon** “Share screen” / “Stop sharing”; **browser permission** for display capture may fail independently of camera — map errors to **`callErrorPermission`** or a dedicated **`callErrorScreenshare`** string.

**v1 vs later:**

| Feature                                        | Spec status                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mic, camera, leave, participant tiles (camera) | **v1** (§3.3–§3.4).                                                                                                                                  |
| **Screen share**                               | **Specified** for layout + hook (§2.4, §3.5); **implement in v1** if product prioritizes; otherwise **v1.1** — document choice in implementation PR. |
| **Active speaker** highlight                   | **Optional** — subscribe if SDK exposes stable **`activeSpeaker`**; visual ring on tile.                                                             |
| **Call stats / debug**                         | **Optional** — dev-only overlay.                                                                                                                     |
| **Push-to-talk**                               | **Out of scope** v1 unless product requests.                                                                                                         |

### 3.6 `threadRootEventId` source

Until Signal/thread routing is wired end-to-end:

- **v1:** Pass **`null`** and ship toolbar **disabled** with tooltip “Coming soon”, **or** plumb **`threadRootEventId`** from the route/store where Signal is already available (if any). **Document the chosen branch in the PR** that implements this spec.

**Grep target for integration:** coherence uses `openCoherenceChat`; space mode resolves `roomId` in `HumanRightPanel` — thread id must come from the same **coherence / space** feature that renders “Signal” (add prop drill-down as needed).

### 3.7 i18n

**Files:** `packages/i18n/src/messages/{en,de,es,fr,pt}.json` under **`HumanChatPanel`**:

| Key                                            | Purpose                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `callAudio`                                    | Audio call button                                                          |
| `callVideo`                                    | Video call button                                                          |
| `callSearch`                                   | Search (thread/space)                                                      |
| `callActiveInSpace`                            | Banner title                                                               |
| `callConnecting`                               | Banner connecting state                                                    |
| `callLeave`                                    | Leave button                                                               |
| `callMute` / `callUnmute`                      | Mic                                                                        |
| `callCameraOn` / `callCameraOff`               | Camera                                                                     |
| `callScreenshareStart` / `callScreenshareStop` | Screen share toggle                                                        |
| `callErrorPermission`                          | Mic/camera denied                                                          |
| `callErrorScreenshare`                         | Display capture denied / failed                                            |
| `callErrorGeneric`                             | Fallback                                                                   |
| `callSearchComingSoon`                         | Search stub tooltip                                                        |
| `callFullView`                                 | **Full view** / expand button (`aria-label`) and optional dialog **title** |
| `callFullViewClose`                            | Close / dismiss full-view modal (button)                                   |
| `callLayoutMode` / `callLayoutFilmstrip` / `callLayoutSideBySide` / `callLayoutSpeakerOnTop` / `callLayoutPip` | **Full view** — screen-share **layout** menu (§3.4.4.3) and option labels  |
| `callPaneResizeSharePeople` / `callPaneResizeShareStrip` / `callPaneResizeSpeakerShare` | `aria-label` for **draggable** **splitter** (§3.4.4.2 **SS-5**) |
| `callLeftAudio` / `callLeftVideo` / `callLeftBannerDismiss` | **Leave** confirmation in the **join** row when idle (dismiss with **X**) |
| `callJoinStripTitle` / `callJoinStripDevices`   | **Join** strip: heading + “N devices in call” (pluralized)                 |
| `callJoinWithAudio` / `callJoinWithVideo`        | `aria-label` for **Join** strip and toolbar when room call is active         |
| `callJoinWithAudioShort` / `callJoinWithVideoShort` | Short button labels in the strip                                        |
| `callYouAreInSpaceCall` / `callDeviceCountInRoom` / `callOthersInCallHint` | **Banner** copy when **connected** (space call + device / others counts)   |
| `callMembersTabJoinCallTitle` / `callMembersTabJoinCallBody` / `callMembersTabInCallPreamble` | **Members** tab: idle hint + in-call roster helper text          |
| `callJoinInviteTitle` / `callJoinInviteDescription`  | **Join invitation** modal: title + body (space-wide; device count interpolation)   |
| `callJoinInviteJoinAudio` / `callJoinInviteJoinVideo` | Modal primary/secondary = same actions as **Join** strip                         |
| `callJoinInviteDismiss`                                | "Not now" / dismiss (no leave — user not in call)                                  |
| `callJoinAlertSound` (settings label) / `callJoinAlertSoundOn` / `callJoinAlertSoundOff` | Optional: sound toggle in settings or call-preferences (§1.2.1)               |

Follow [i18n-translate skill](../../.agents/skills/i18n-translate/SKILL.md) for locale parity.

---

## 4) Apps/web constraints

**File:** `apps/web/next.config.ts`

- Keep **`serverExternalPackages: ['matrix-js-sdk']`** and existing **alias** for a single bundle — do not introduce a second resolution path when adding VoIP.

**CSP / headers:** If media or workers are blocked in production, document **required** CSP exceptions in the PR (coordinate with security role).

---

## 5) Traceability — implementation requirements

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IMP-1** | Implement **`GroupCall`** lifecycle in **`@hypha-platform/core`** client code only; epics consume hooks / context.                                                                                                                                                                                                                                                                                                                  |
| **IMP-2** | **Leave** and **unmount** must **stop** local `MediaStream` tracks and **leave** the `GroupCall`.                                                                                                                                                                                                                                                                                                                                   |
| **IMP-3** | UI must **not** claim “thread-only” or “private to this signal” for the media path.                                                                                                                                                                                                                                                                                                                                                 |
| **IMP-4** | **One** concurrent group call session per **`roomId`** in the client state machine.                                                                                                                                                                                                                                                                                                                                                 |
| **IMP-5** | All user-visible errors map to **`HumanChatPanel.*`** strings (no raw SDK errors in production UI; log details to console in dev).                                                                                                                                                                                                                                                                                                  |
| **IMP-6** | In-call UI SHALL follow **§3.1–§3.4**: combined **tabs + call/search** row, **banner** below, **video stage** above messages when `callKind === 'video'` and connected.                                                                                                                                                                                                                                                             |
| **IMP-7** | When screen share is in scope for the release, stage SHALL render **`screenshareFeeds`** per **§3.5**; hook SHALL expose **`setScreensharingEnabled`** / **`isScreensharing`**.                                                                                                                                                                                                                                                     |
| **IMP-8** | **Full view** (optional but specified): When implemented, in-call **modal enlarged stage** SHALL follow **§3.4.4** and **§3.4.4.1** (dialog overlay, **primary stage** fills the modal between header and controls, no narrow-tile + empty-void layout, **single** `srcObject` tree, a11y, i18n). **Browser native Fullscreen** (`Element.requestFullscreen`) is **out of scope** for **IMP-8** unless a future ticket promotes it. |
| **IMP-9** | **Join + idle subscription** (see **§1.1**, **§2.2**, **§3.2.1**): Hook SHALL keep **device** and **roster** state accurate **before** local `enter` via the **GroupCall.ended** + `ParticipantsChanged` path; UI SHALL show **join** affordances when `showRoomCallInProgress` is true; `enterAudio` / `enterVideo` SHALL use **get-then-create** for a **single** room `GroupCall` per **§1.1**. |
| **IMP-10** | **Join alert (optional product slice)** (see **§1.2**, **§3.2.2**): When built, **idle** members SHALL get **throttled** **chime** (toggle) + **join invitation** `Dialog` per **§1.2.1**–**§1.2.2**; SHALL respect **autoplay**, **visibility** (pair with `Notification` when allowed), and **a11y**; SHALL **not** re-open the modal on every `ParticipantsChanged`. **Matrix** behavior unchanged. |

---

## 6) Testing

| Layer      | Scope                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**   | State machine: idle → enter → leave; double-enter no-op; error codes; `isPermissionLikeGroupCallError` (or equivalent). Mock `MatrixClient`. For **§1.1**: optional unit tests for **device vs user** counting from a mocked `participants` map. |
| **Manual** | Script in PR description: two browsers, same Space, verify audio path + leave cleanup. If **IMP-10** is implemented: verify **chime** once, modal **dismiss** / **re-open** throttling, **off** in settings, **no** chime with tab in background (or + notification).   |
| **E2E**    | Playwright: **optional** for v1—assert toolbar **visible** and **disabled** state if no media permission in CI; skip real WebRTC if unstable. |

---

## 7) Acceptance criteria (v1 done)

- [ ] Space chat panel shows **audio** and **video** actions when `roomId` is ready and Matrix is authenticated.
- [ ] User can **start** a call, see **connected** state, **mute** mic, **toggle** camera (if video path), and **leave** without reload.
- [ ] **Layout** matches **§3.1**: tabs + phone/video/search on one row; **banner** under it; **video stage** (when applicable) above messages in Chat tab.
- [ ] **Stage** can show **camera tiles** and, when implemented, **screen-share** tiles from **`userMediaFeeds` / `screenshareFeeds`** (**§3.5**).
- [ ] (When **§3.4.4** is in scope) User can open **Full view** from the call stage, see the **enlarged** share/camera layout in a **modal** that satisfies **§3.4.4.1** (neat, large **primary** image in the fill area), and **close** it without **leaving** the call; **focus** and **Esc** behave per **§3.4.4**.
- [ ] Second participant in the **same Space** can **join** the same session (same `roomId`); while **user B** is still **idle**, the panel shows **call in progress** and **join** per **§1.1** / **§3.2.1** (strip + **Join** toolbar copy), and counts update without requiring B to “start” a new call.
- [ ] (When **IMP-10** / **§1.2** is in scope) Idle member receives a **throttled** join **chime** (when enabled) and a **dismissable** **join invitation** modal per **§1.2**; no modal re-open on each participant count tick; `Esc` / **Not now** do not end other participants’ call.
- [ ] No duplicate `matrix-js-sdk` bundles; no VoIP code on server.
- [ ] Copy reflects **space-wide** call semantics.

---

## 8) File checklist (create / touch)

| Action     | Path                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit       | `packages/core/src/matrix/client/providers/matrix-provider.tsx` — `createClient` opts + export call hook or provider bridge                                                                       |
| Add        | `packages/core/src/matrix/client/hooks/use-space-group-call.ts` (or equivalent name)                                                                                                              |
| Export     | `packages/core/src/matrix/client/index.ts` (or barrel) — public API                                                                                                                               |
| Add        | `packages/epics/src/common/human-chat-panel/human-chat-panel-call-toolbar.tsx`                                                                                                                    |
| Add        | `packages/epics/src/common/human-chat-panel/human-chat-panel-call-banner.tsx`                                                                                                                     |
| Add / Edit | `packages/epics/src/common/human-chat-panel/human-chat-panel-call-stage.tsx` (video grid + local PiP); optional **§3.4.4** — full-view trigger + `Dialog` wrapper (or shared stage sub-component) |
| Add        | (Optional **IMP-10**) `human-chat-panel-call-join-invitation.tsx` + static **chime** asset or Web Audio helper — per **§1.2** / **§3.2.2** |
| Edit       | `packages/epics/src/common/human-right-panel.tsx` — wire toolbar + banner                                                                                                                         |
| Edit       | `packages/epics/src/common/human-chat-panel/index.ts` — re-exports                                                                                                                                |
| Edit       | `packages/i18n/src/messages/*.json` — keys under `HumanChatPanel`                                                                                                                                 |

---

## 9) References

- [MatrixClient](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html), [GroupCall](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html), [ICreateClientOpts](https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ICreateClientOpts.html)
- Parent: [voice-video-call-matrix-tech-spec.md](./voice-video-call-matrix-tech-spec.md)
- Hypha mapping: [`.agents/references/domain/hypha-matrix-mapping.md`](../../.agents/references/domain/hypha-matrix-mapping.md)
