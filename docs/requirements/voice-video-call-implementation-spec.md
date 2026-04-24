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
| **Signal / thread role**     | **`threadRootEventId`** identifies **which Signal** initiated or last focused the call UI; used for optional **thread notice** messages and analytics—not for access control.                                                                                                                 |
| **Modes**                    | **Audio-first** and **Video** entry points: both use **`GroupCall`**; video intent enables camera when entering (subject to permissions).                                                                                                                                                     |
| **Coherence vs Space panel** | **v1:** Implement for **`HumanRightPanel` space mode** (`mode === 'space'`) where the panel has a resolved **`roomId`** for the Space. **Coherence mode** (`mode === 'coherence'`) is **out of scope** unless the same `roomId` + thread rules are explicitly extended in a follow-up ticket. |

---

## 2) Matrix integration (packages/core)

### 2.1 `createClient` options (`matrix-provider.tsx`)

**File:** `packages/core/src/matrix/client/providers/matrix-provider.tsx`

Extend `MatrixSdk.createClient({ ... })` with **explicit** VoIP-related options (do not rely on defaults alone—document intent in code):

| Option                     | Value (v1 recommendation)                                           | Rationale                                                    |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `disableVoip`              | `false`                                                             | Enable TURN fetch and VoIP stack.                            |
| `useE2eForGroupCall`       | `true` (default in typings)                                         | Encrypt to-device signaling for group calls where supported. |
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

```
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

**Root cause (typical):** A single `flex` row where the **tab `tablist`** and the **call `tabRowEnd`** + **settings** all compete for width. The scrollable region (`overflow-x-auto` + `flex-1` + `min-w-0`) can shrink the **inner** width of a tab so aggressively that the **label truncates per-character**; the user reads overlap where it is really **clipping** inside the tab, adjacent to a **fixed** icon group.

**Proposed implementation rules (pick one pattern and document in the PR; all satisfy the AC below):**

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **Reserved width for the right cluster:** The combined **call toolbar** (`tabRowEnd`) and **settings** `Link` SHALL be **`shrink-0`** (or `flex-none`) so they **never** compress. Icon buttons keep a **fixed** footprint (e.g. `h-7` + square hit targets) matching **`human-chat-panel-call-toolbar.tsx`**.                                                                                                                              |
| R2  | **Tab rail is the flexible region:** The **`role="tablist"`** region SHALL sit in a **separate** flex or grid track with **`min-w-0`** so it may scroll horizontally, but **MUST NOT** be given layout rules that let **individual tab buttons** shrink below a **minimum readable** width (see AC).                                                                                                                                        |
| R3  | **No accidental overlap (stacking):** Tab **`<button>`**s and the right cluster SHALL share one row **without** `z-index` “fixes” on tabs that would paint **above** the call icons. If layering is ever needed, use a **subtle** separator (e.g. `border-s` on the end cluster) + ensure backgrounds are **opaque** on the icon group — not higher `z-index` on the tab list.                                                              |
| R4  | **Active tab chrome:** The selected tab’s **border / ring** (e.g. `ring-inset`) **MUST** stay **inside** the button’s **border box** — no `outline-offset` or shadow that extends **into** the icon column.                                                                                                                                                                                                                                 |
| R5  | **Optional more robust row model:** Use **`grid`** with explicit columns, e.g. \*\*`1fr`                                                                                                                                                                                                                                                                                                                                                    | `auto` | `auto`**: column 1 = scrollable `tablist` (`min-w-0`); columns 2–3 = `tabRowEnd` and settings, **`minmax(0, max-content)`\*\* or `auto` + `shrink-0`. This avoids `flex-1` ambiguity between siblings. |
| R6  | **Narrowest panel:** If product defines a **minimum** chat panel width, verify this row at that width in **en** and longest locale; if labels still do not fit, the **`tablist`** **horizontal scroll** SHALL remain the **only** overflow (fade or scrollbar **not** hidden in a way that confuses — current `[scrollbar-width:none]` is acceptable if **swipe/scroll** still works on touch; desktop may show a thin scrollbar on focus). |

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
- **`callState === 'connected'`:** **Recommended:** keep header icons **visible** with **`aria-pressed={true}`** on phone/video, or rely on **banner-only** controls — pick one pattern and stay consistent.

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

### 3.3 Active-call banner (space-wide + primary controls)

**Component:** `human-chat-panel-call-banner.tsx`

**Placement:** Immediately **below** the Chat / Members / Pins + icons row, **above** `SidebarContent` (or above the split **stage + messages** region when video is active).

| Element        | Requirement                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Label**      | **Must** indicate a **space** call (e.g. “Space call”, “Call in this space”) — not “Signal-only”. Optional: **participant count**.                                    |
| **Timer**      | **Optional v1.1:** `mm:ss` since connected; otherwise show **Connecting…** / **Connected**.                                                                           |
| **Mute**       | Toggles mic; reflects `GroupCall` state.                                                                                                                              |
| **Camera**     | Toggle video mute / camera off. **Hide** when session is **audio-only** (`callKind === 'audio'`) or show **disabled** — choose one and document in implementation PR. |
| **Leave**      | Primary destructive control; calls `leave()`.                                                                                                                         |
| **Connecting** | Spinner + disabled primary controls until `connected`.                                                                                                                |

**Errors:** If `callState === 'error'`, show compact message with optional **Retry** / **Dismiss**.

### 3.4 During-call — audio vs video (main panel)

#### 3.4.1 Audio-only (`enterAudio`, camera off)

- **No** full-screen video stage required.
- **Optional v1:** Thin strip under banner: local avatar + mic indicator.
- **Chat tab:** Message list remains **primary**; banner stays at **top** of panel while scrolling.

#### 3.4.2 Video (`enterVideo` or camera on after join)

**Component:** `human-chat-panel-call-stage.tsx`

- When `activeTab === 'chat'` and `callState === 'connected'` and **video is active** (local or remote):
  - **Top** of `SidebarContent`: **stage** with **remote** participant tiles (from SDK feeds) and **local** preview as **picture-in-picture** in a **corner** (e.g. bottom-end) so tabs/header stay unobstructed.
  - **Below** stage: **scrollable** message list (split view). **Min-height** for stage (e.g. `min-h-[220px]` or ~40% panel height) — tune with design.
- **Camera off (video muted):** **Collapse** to audio-only presentation (avatars or placeholders); **keep** banner controls.

#### 3.4.3 Tab switching during a call

- **Members** / **Pins:** Banner **stays visible**; call continues in background.
- **Chat:** Stage + messages as **§3.4.2** when video active.

**IMP:** Panel unmount or leaving Space **must** `leave()` and release `MediaStream` tracks.

#### 3.4.4 Full view (enlarged call stage — **modal**)

**Problem:** The in-panel **call stage** is **narrow** (right sidebar). Users need a **larger** view of **shared screen** and **camera** tiles for review, demos, and legibility without changing the underlying `GroupCall` / WebRTC model.

**Normative product behavior**

| Topic                            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**                      | A **tertiary** control: **“Full view”** (icon: **expand / maximize** — e.g. Lucide `Maximize2` or equivalent; **not** the browser **Fullscreen API** _unless_ product explicitly requests it later). The control is visible whenever **§3.4.2** / **§3.5** renders a **visible call stage** (`callState === 'connected'` and stage is not `null` — includes **screen share**-only and **video** paths). **Disabled** or **hidden** when there is **no** stage to enlarge (e.g. **audio-only** with no share and no video tiles as per current collapse rules).                                                                  |
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

---

## 6) Testing

| Layer      | Scope                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**   | State machine: idle → enter → leave; double-enter no-op; error codes. Mock `MatrixClient`.                                                    |
| **Manual** | Script in PR description: two browsers, same Space, verify audio path + leave cleanup.                                                        |
| **E2E**    | Playwright: **optional** for v1—assert toolbar **visible** and **disabled** state if no media permission in CI; skip real WebRTC if unstable. |

---

## 7) Acceptance criteria (v1 done)

- [ ] Space chat panel shows **audio** and **video** actions when `roomId` is ready and Matrix is authenticated.
- [ ] User can **start** a call, see **connected** state, **mute** mic, **toggle** camera (if video path), and **leave** without reload.
- [ ] **Layout** matches **§3.1**: tabs + phone/video/search on one row; **banner** under it; **video stage** (when applicable) above messages in Chat tab.
- [ ] **Stage** can show **camera tiles** and, when implemented, **screen-share** tiles from **`userMediaFeeds` / `screenshareFeeds`** (**§3.5**).
- [ ] (When **§3.4.4** is in scope) User can open **Full view** from the call stage, see the **enlarged** share/camera layout in a **modal** that satisfies **§3.4.4.1** (neat, large **primary** image in the fill area), and **close** it without **leaving** the call; **focus** and **Esc** behave per **§3.4.4**.
- [ ] Second participant in the **same Space** can **join** the same session (same `roomId`).
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
| Edit       | `packages/epics/src/common/human-right-panel.tsx` — wire toolbar + banner                                                                                                                         |
| Edit       | `packages/epics/src/common/human-chat-panel/index.ts` — re-exports                                                                                                                                |
| Edit       | `packages/i18n/src/messages/*.json` — keys under `HumanChatPanel`                                                                                                                                 |

---

## 9) References

- [MatrixClient](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html), [GroupCall](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html), [ICreateClientOpts](https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ICreateClientOpts.html)
- Parent: [voice-video-call-matrix-tech-spec.md](./voice-video-call-matrix-tech-spec.md)
- Hypha mapping: [`.agents/references/domain/hypha-matrix-mapping.md`](../../.agents/references/domain/hypha-matrix-mapping.md)
