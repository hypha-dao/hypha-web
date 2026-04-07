# Implementation specification — Space room calls with Signal (thread) context

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready to implement |
| **Parent** | [signal-thread-voip-matrix-tech-spec.md](./signal-thread-voip-matrix-tech-spec.md) |
| **SDK** | `matrix-js-sdk@^40.0.0` (no v41+ in Next.js until platform upgrade) |
| **Architecture** | **Option A** — `GroupCall` on **Space `roomId`**; **`threadRootEventId`** is **app context + optional timeline notice** only |

---

## 1) Locked product semantics (normative for v1)

| Topic | Decision |
|-------|----------|
| **Call scope** | **One active Matrix group call per Space (`roomId`)** at a time. Parallel “different thread, different call” in the **same** Space is **out of scope** for v1 (see parent doc). |
| **Who can be in the call** | **All members of the Matrix room** (Hypha Space) may join; the SDK does **not** enforce thread-only membership. UI **must** label the call as **space-wide** (e.g. “Space call”) to avoid implying thread isolation. |
| **Signal / thread role** | **`threadRootEventId`** identifies **which Signal** initiated or last focused the call UI; used for optional **thread notice** messages and analytics—not for access control. |
| **Modes** | **Audio-first** and **Video** entry points: both use **`GroupCall`**; video intent enables camera when entering (subject to permissions). |
| **Coherence vs Space panel** | **v1:** Implement for **`HumanRightPanel` space mode** (`mode === 'space'`) where the panel has a resolved **`roomId`** for the Space. **Coherence mode** (`mode === 'coherence'`) is **out of scope** unless the same `roomId` + thread rules are explicitly extended in a follow-up ticket. |

---

## 2) Matrix integration (packages/core)

### 2.1 `createClient` options (`matrix-provider.tsx`)

**File:** `packages/core/src/matrix/client/providers/matrix-provider.tsx`

Extend `MatrixSdk.createClient({ ... })` with **explicit** VoIP-related options (do not rely on defaults alone—document intent in code):

| Option | Value (v1 recommendation) | Rationale |
|--------|---------------------------|-----------|
| `disableVoip` | `false` | Enable TURN fetch and VoIP stack. |
| `useE2eForGroupCall` | `true` (default in typings) | Encrypt to-device signaling for group calls where supported. |
| `useLivekitForGroupCalls` | `false` | Native WebRTC via SDK for v1; LiveKit is a later epic. |
| `forceTURN` | `false` initially; expose env/feature flag if enterprise NAT issues | Stricter relay; test in staging. |
| `fallbackICEServerAllowed` | align with security review | Only enable if HS provides no TURN and product approves. |
| `iceCandidatePoolSize` | `0` or small positive (e.g. `5`) per perf testing | Trade startup vs privacy/battery. |

**Do not** import `matrix-js-sdk` in Server Components; this file is already **`'use client'`**.

### 2.2 New context API: `SpaceCallController`

Expose a **narrow** API on `MatrixContextType` (same provider file) or a **dedicated** `React.Context` next to Matrix to avoid bloating `useMatrix()`:

**Recommended:** add `packages/core/src/matrix/client/hooks/use-space-group-call.ts` exporting:

- **`useSpaceGroupCall(roomId: string | null)`** returning:

| Field / method | Type | Behavior |
|----------------|------|----------|
| `callState` | `'idle' \| 'initializing' \| 'awaiting_media' \| 'connecting' \| 'connected' \| 'disconnecting' \| 'error'` | Drives UI. |
| `errorCode` | `null \| 'NO_CLIENT' \| 'NO_ROOM' \| 'NOT_READY' \| 'PERMISSION_DENIED' \| 'WEBRTC_FAILED' \| 'UNKNOWN'` | Map to i18n. |
| `threadContext` | `{ threadRootEventId: string } \| null` | Set when user starts/joins from Signal UI. |
| `enterAudio(threadRootEventId?)` | `Promise<void>` | `waitUntilRoomReadyForGroupCalls` → get/create `GroupCall` → `enter` with **audio** intent (mic on, camera off). |
| `enterVideo(threadRootEventId?)` | `Promise<void>` | Same with **video** (request camera + mic). |
| `leave()` | `Promise<void>` | `GroupCall.leave` / cleanup; **stop all local tracks**. |
| `setMicrophoneMuted` | `(muted: boolean) => Promise<void>` | Delegate to `GroupCall` when connected. |
| `setCameraMuted` | `(muted: boolean) => Promise<void>` | Use SDK’s video mute API (see `GroupCall` / local feed). |
| `localPreviewStream` | `MediaStream \| null` | Optional: for local preview `<video>` (implementation detail). |
| `participantSummary` | `{ count: number }` or SDK-derived | For header badge. |

**Matrix client usage (normative sequence):**

1. Guard: `if (!client || !roomId) return`.
2. `await client.waitUntilRoomReadyForGroupCalls(roomId)` (handle rejection → `NOT_READY`).
3. Resolve group call: use **`client.getGroupCallForRoom(roomId)`**; if **null**, **`client.createGroupCall(...)`** with types from **`GroupCallType`** / **`GroupCallIntent`** per [matrix-js-sdk](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html) — align **audio vs video** with product (Element Web is the reference for argument ordering).
4. `await groupCall.enter()` after local media where required.
5. Subscribe to **`GroupCall`** / **`CallEvent`** listeners for connection failures → `WEBRTC_FAILED`.
6. On unmount or `leave()`, remove listeners, **terminate** or **leave** per SDK contract, and **revoke media tracks**.

**Idempotency:** If user taps **Audio** twice, second tap should **no-op** or **join** same session—no duplicate `GroupCall` instances for the same `roomId`.

### 2.3 Optional thread timeline notice

**If** product enables FR-5 (parent doc): add **`sendThreadCallNotice(roomId, threadRootEventId, body)`** using existing thread send pattern (`m.relates_to` with `rel_type: m.thread`) — mirror **`sendMessage`** thread logic from matrix engineer role / `sendEvent` helpers. **Gate** behind a boolean `postThreadNoticeOnCallStart` in config or constant for v1.

---

## 3) UI integration (packages/epics)

### 3.1 Placement

**File:** `packages/epics/src/common/human-right-panel.tsx`

- **When:** `mode === 'space'` and `roomId` is non-null and Matrix is authenticated.
- **Where:** Add a **toolbar row** between **`HumanChatPanelHeader`** and **`HumanChatPanelTabs`**, or **extend** the header to a two-row layout:
  - **Row 1:** existing back/title (header).
  - **Row 2:** tabs **left**; **call actions + optional search** **right** (match design mocks).

**New presentational component (recommended):**

- `packages/epics/src/common/human-chat-panel/human-chat-panel-call-toolbar.tsx`

Props (illustrative):

```typescript
type HumanChatPanelCallToolbarProps = {
  roomId: string;
  threadRootEventId: string | null; // null until Signal/thread is wired
  disabled?: boolean;
  onAudioClick: () => void;
  onVideoClick: () => void;
  // optional: onSearchClick when search epic exists
};
```

**Accessibility:**

- Buttons: `aria-label` from i18n; **`aria-pressed`** or live region when call active if toggling join state.

### 3.2 Active call chrome

When `callState === 'connected'` (or `'connecting'` with spinner):

- Render **`HumanChatPanelCallBanner`** (new) **below** the toolbar or **above** `SidebarContent`:
  - Text: **space-wide** wording, e.g. “Space call active” + duration (optional v1.1).
  - Actions: **Mute**, **Camera off**, **Leave**.
- **Media tiles:** v1 can be **minimal** (local preview + participant count) or **grid**—product choice; spec requires **no** raw `MediaStream` leaks on navigation away (unmount `leave()`).

### 3.3 `threadRootEventId` source

Until Signal/thread routing is wired end-to-end:

- **v1:** Pass **`null`** and ship toolbar **disabled** with tooltip “Coming soon”, **or** plumb **`threadRootEventId`** from the route/store where Signal is already available (if any). **Document the chosen branch in the PR** that implements this spec.

**Grep target for integration:** coherence uses `openCoherenceChat`; space mode resolves `roomId` in `HumanRightPanel` — thread id must come from the same **coherence / space** feature that renders “Signal” (add prop drill-down as needed).

### 3.4 i18n

**Files:** `packages/i18n/src/messages/{en,de,es,fr,pt}.json` under **`HumanChatPanel`**:

| Key | Purpose |
|-----|---------|
| `callAudio` | Audio call button |
| `callVideo` | Video call button |
| `callActiveInSpace` | Banner title |
| `callLeave` | Leave button |
| `callMute` / `callUnmute` | Mic |
| `callCameraOn` / `callCameraOff` | Camera |
| `callErrorPermission` | Mic/camera denied |
| `callErrorGeneric` | Fallback |

Follow [i18n-translate skill](../../.agents/skills/i18n-translate/SKILL.md) for locale parity.

---

## 4) Apps/web constraints

**File:** `apps/web/next.config.ts`

- Keep **`serverExternalPackages: ['matrix-js-sdk']`** and existing **alias** for a single bundle — do not introduce a second resolution path when adding VoIP.

**CSP / headers:** If media or workers are blocked in production, document **required** CSP exceptions in the PR (coordinate with security role).

---

## 5) Traceability — implementation requirements

| ID | Requirement |
|----|----------------|
| **IMP-1** | Implement **`GroupCall`** lifecycle in **`@hypha-platform/core`** client code only; epics consume hooks / context. |
| **IMP-2** | **Leave** and **unmount** must **stop** local `MediaStream` tracks and **leave** the `GroupCall`. |
| **IMP-3** | UI must **not** claim “thread-only” or “private to this signal” for the media path. |
| **IMP-4** | **One** concurrent group call session per **`roomId`** in the client state machine. |
| **IMP-5** | All user-visible errors map to **`HumanChatPanel.*`** strings (no raw SDK errors in production UI; log details to console in dev). |

---

## 6) Testing

| Layer | Scope |
|-------|--------|
| **Unit** | State machine: idle → enter → leave; double-enter no-op; error codes. Mock `MatrixClient`. |
| **Manual** | Script in PR description: two browsers, same Space, verify audio path + leave cleanup. |
| **E2E** | Playwright: **optional** for v1—assert toolbar **visible** and **disabled** state if no media permission in CI; skip real WebRTC if unstable. |

---

## 7) Acceptance criteria (v1 done)

- [ ] Space chat panel shows **audio** and **video** actions when `roomId` is ready and Matrix is authenticated.
- [ ] User can **start** a call, see **connected** state, **mute** mic, **toggle** camera (if video path), and **leave** without reload.
- [ ] Second participant in the **same Space** can **join** the same session (same `roomId`).
- [ ] No duplicate `matrix-js-sdk` bundles; no VoIP code on server.
- [ ] Copy reflects **space-wide** call semantics.

---

## 8) File checklist (create / touch)

| Action | Path |
|--------|------|
| Edit | `packages/core/src/matrix/client/providers/matrix-provider.tsx` — `createClient` opts + export call hook or provider bridge |
| Add | `packages/core/src/matrix/client/hooks/use-space-group-call.ts` (or equivalent name) |
| Export | `packages/core/src/matrix/client/index.ts` (or barrel) — public API |
| Add | `packages/epics/src/common/human-chat-panel/human-chat-panel-call-toolbar.tsx` |
| Add | `packages/epics/src/common/human-chat-panel/human-chat-panel-call-banner.tsx` (optional split) |
| Edit | `packages/epics/src/common/human-right-panel.tsx` — wire toolbar + banner |
| Edit | `packages/epics/src/common/human-chat-panel/index.ts` — re-exports |
| Edit | `packages/i18n/src/messages/*.json` — keys under `HumanChatPanel` |

---

## 9) References

- [MatrixClient](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html), [GroupCall](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html), [ICreateClientOpts](https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ICreateClientOpts.html)
- Parent: [signal-thread-voip-matrix-tech-spec.md](./signal-thread-voip-matrix-tech-spec.md)
- Hypha mapping: [`.agents/references/domain/hypha-matrix-mapping.md`](../../.agents/references/domain/hypha-matrix-mapping.md)
