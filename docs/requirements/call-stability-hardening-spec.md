# Implementation specification — Call stability hardening (Human panel)

## Document control

| Field | Value |
| ----- | ----- |
| **Status** | Ready to implement (spec only) — merged into consolidated call epic |
| **Parent** | [voice-video-call-implementation-spec.md](./voice-video-call-implementation-spec.md), [voice-video-call-matrix-tech-spec.md](./voice-video-call-matrix-tech-spec.md) |
| **Companion spec** | [call-world-class-ux-spec.md](./call-world-class-ux-spec.md) (`WCUX-*` UX requirements) |
| **Implementation plan** | [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md) (single PR — supersedes [call-stability-hardening-plan.md](./call-stability-hardening-plan.md) §11) |
| **Historical plan** | [call-stability-hardening-plan.md](./call-stability-hardening-plan.md) (phased reference from PR [#2285](https://github.com/hypha-dao/hypha-web/pull/2285)) |
| **ADR** | [0001 — recording pipeline](../adr/0001-voice-video-recording-pipeline.md) |
| **Hotfix context** | PR [#2284](https://github.com/hypha-dao/hypha-web/pull/2284) (`fix/call-banner-regression`) — banner + share handoff regressions from PRs #2273 / #2276 |
| **Architecture (v1)** | Matrix `GroupCall` with **mesh WebRTC** (`useLivekitForGroupCalls: false`) |

---

## 1) Problem statement

Production regressions and reliability gaps were identified in May 2026 around the Human panel call experience:

1. **Call banner hidden** when the floating call dock is open (regression re-introduced in PR #2276).
2. **Screen share layout collapse** during presenter handoff (warming remote feeds not accounted for).
3. **Mesh WebRTC limits** — no product guardrails for participant count; UI gallery paginates at 20 tiles but WebRTC does not scale to “community call” sizes.
4. **Recording pipeline** — client-side canvas compositor is fragile at scale; ADR 0001 defers primary path to SFU egress.
5. **Reliability edges** — multi-tab sync leadership, signal deep-link auth timing, mobile screen share policy, tab keepalive side effects.

This document defines **normative requirements** to make calls, screen sharing, and recordings **stable and predictable** within the current mesh architecture, and defines the **upgrade path** for large-audience calls.

---

## 2) Scale model (normative product bounds)

### 2.1 Current media topology

| Property | Value |
| -------- | ----- |
| Signaling | Matrix `GroupCall` on Space `roomId` |
| Media | Native matrix-js-sdk WebRTC (**pairwise** `m.call.*` between peers) |
| SFU | **Not enabled** (`useLivekitForGroupCalls: false`) |
| Reference | `packages/core/src/matrix/client/hooks/use-space-group-call.ts` (pairwise placement comments) |

### 2.2 Participant tiers (product + engineering)

These tiers **SHALL** be documented in product copy and used for QA load targets. They are **not** hard join caps unless explicitly implemented in a later phase.

| Tier | Device count in `GroupCall.participants` | Expected reliability | Product positioning |
| ---- | ---------------------------------------- | -------------------- | ------------------- |
| **S — Small** | 2–8 | High for audio + video + share + recording | Default “team call” |
| **M — Medium** | 8–15 | Degraded: CPU/bandwidth pressure, more stall/recover cycles | “Extended team call” with caution |
| **L — Large (unsupported mesh)** | 15–30+ | Poor: dropped feeds, high latency, tab crashes likely | **Do not market** until SFU epic ships |
| **XL — Community** | 30–500+ | Requires SFU (LiveKit or vendor) | Out of scope for mesh v1 |

**Device count vs user count:** Count **devices** (each `RoomMember` × device map entry), not unique users. One person on laptop + phone = 2 devices.

### 2.3 UI display limits (distinct from WebRTC limits)

| Constant | Value | File |
| -------- | ----- | ---- |
| Gallery mode threshold | 4+ tiles | `call-gallery-grid.ts` → `CALL_GALLERY_MIN_PARTICIPANTS` |
| Tiles per gallery page | 20 | `call-gallery-grid.ts` → `CALL_GALLERY_MAX_TILES_PER_PAGE` |
| Recording compositor | 854×480 @ 24fps | `call-recording-constants.ts` |
| Recording max duration | 90 min | `call-recording-constants.ts` |
| Recording max file size | 640 MB | `call-recording-constants.ts` |

**CSH-SCALE-1:** The UI **MAY** paginate gallery beyond 20 tiles; it **SHALL NOT** imply that all remote feeds are decoded simultaneously beyond mesh practical limits (§2.2 tier M).

**CSH-SCALE-2:** When device count exceeds tier **M** (configurable threshold, default **12**), the UI **SHALL** show a non-blocking warning banner: “This call has many participants. Quality may be reduced.” (i18n key TBD in `HumanChatPanel`.)

**CSH-SCALE-3:** When device count exceeds tier **L** (default **20**), the UI **SHOULD** recommend SFU upgrade path in internal/admin docs only until SFU is available; **SHALL NOT** block join in v1 unless product explicitly requests a cap.

---

## 3) Sidebar vs floating dock contract (CSH-CHROME)

### 3.1 Split visibility flags

**Problem:** Gating all sidebar call UI with `!showFloatingDock` hid the in-chat call banner while the dock was active.

**Normative model:**

| Surface | When visible | Contents |
| ------- | ------------ | -------- |
| **Sidebar call chrome** (`showSidebarCallChrome`) | `callUiEnabled && callAppliesToCurrentChatRoom` | Join strip, call banner (participant count, leave, errors), capture consent |
| **Sidebar call video** (`showSidebarCallVideo`) | above **AND** `!showFloatingDock` | In-panel `HumanChatPanelCallStage`, screenshare takeover dialog (sidebar instance) |
| **Floating dock** | Global call dock active for same session | Controls, optional error/stall banner, stage, dock-owned takeover dialog |

**CSH-CHROME-1:** `showSidebarCallChrome` **SHALL NOT** depend on `showFloatingDock`.

**CSH-CHROME-2:** `showSidebarCallVideo` **SHALL** depend on `!showFloatingDock` (video stage lives in one place).

**CSH-CHROME-3:** `HumanChatPanelCallBanner` in sidebar **SHALL** remain visible when dock is open (controls mode `leave_only` in sidebar; full controls in dock).

**CSH-CHROME-4:** `HumanChatPanelScreenshareTakeoverDialog` **SHALL** render in **at most one** place: sidebar when `!showFloatingDock`, else dock.

**CSH-CHROME-5:** Dock healthy-call banner (`showDockBanner`) **SHALL** remain **controls-only** — full participant banner is sidebar responsibility. Dock banner **SHALL** show for: `errorCode`, `screenshareErrorCode`, `remoteMediaStall`.

**Reference implementation:** PR #2284 — `human-right-panel.tsx`, `global-call-dock-context.tsx`.

**CSH-CHROME-6 (guardrail):** Add unit test or code comment at `showSidebarCallChrome` definition documenting CSH-CHROME-1; CI **SHALL** fail if `showFloatingDock` is re-added to that expression.

### 3.2 Dock resume snapshot

**CSH-CHROME-7:** When navigating away from the Space while in call, the global dock resume snapshot **SHALL** persist: `signalTitle`, `signalSlug`, `roomTitle`, `roomId`, `spaceSlug`, `threadRootEventId` (existing fields + PR #2284 additions).

---

## 4) Screen share and presenter handoff (CSH-SHARE)

### 4.1 Share layout state machine

Extract share layout resolution into a **pure module** (implemented in PR #2284 as `call-stage-share-layout.ts`):

| State | Condition | UI behavior |
| ----- | --------- | ----------- |
| **Local presenting** | `isScreensharing && no remote live share feeds` | Presenter layout; trust SDK flag before local track is `live` |
| **Remote live share** | Remote feed with `readyState === 'live'` and unmuted video | Dominant share tile + participant band |
| **Remote warming** | Remote feed with track `new` or not yet `live` | Keep share layout; show pending/warming indicator (spinner) |
| **Ended ghost** | Track `ended` | Drop from layout; do not reserve empty share region |

**CSH-SHARE-1:** `resolveCallStageShareLayout()` **SHALL** implement the table above.

**CSH-SHARE-2:** `shareFeedLayoutKey()` **SHALL** change when active share stream identity changes; gallery page index **SHALL** reset on key change.

**CSH-SHARE-3:** After screenshare takeover approval, `useSpaceGroupCall` **SHALL** schedule additional feed batch refreshes (minimum: +350ms and +900ms after approval) to absorb WebRTC handoff latency.

### 4.2 Takeover dialog

**CSH-SHARE-4:** Presenter takeover flow (`screenshare-takeover.ts`) **SHALL** remain functional on desktop; mobile policy per §5.

### 4.3 Mobile screen share policy

**CSH-SHARE-5:** Product **SHALL** choose one policy (document decision in PR):

| Option | Behavior |
| ------ | -------- |
| **A — View only (recommended v1)** | Mobile users can **view** remote share; **cannot** start share or request takeover |
| **B — Auto-stop on resize** | If user was presenting and viewport `< 768px`, automatically stop local share |
| **C — Full parity** | Show share controls on mobile (may fail on OS/browser) |

**CSH-SHARE-6:** If option A or B: when local share is active and viewport crosses mobile breakpoint, **SHALL** stop share or show dismissible warning within 5s.

---

## 5) Mesh call reliability (CSH-MESH)

### 5.1 Pairwise call placement

Matrix group calls use **pairwise VoIP**. Known race: first `placeOutgoingCalls()` after join may skip peers.

**CSH-MESH-1:** Retries **SHALL** remain after enter: 600ms initial + [1500, 4000, 8000, 12000]ms (existing). **SHOULD** add optional 20s retry behind feature flag if stall metrics justify it.

**CSH-MESH-2:** Local media bootstrap retries **SHALL** remain: [800, 2000, 5000, 10000]ms.

### 5.2 Stall detection and recovery

| Timer | Value | Purpose |
| ----- | ----- | ------- |
| `CONNECT_STALL_ABORT_MS` | 90s | Abort hung `gc.enter()` |
| `REMOTE_MEDIA_STALL_MS` | 45s | Banner: others in map but no remote feeds |
| `REMOTE_MEDIA_AUTO_RECOVER_MS` | 70s | Auto recover attempt |

**CSH-MESH-3:** Stall banner copy **SHALL** distinguish:

- **Waiting for media** — participants present, feeds warming (first 45s)
- **Connection problem** — exceeded stall threshold; offer **Retry** / **Leave**

**CSH-MESH-4:** `remoteMediaStall` banner **SHALL** be dismissible; dismissal **SHALL NOT** block auto-recover at 70s.

### 5.3 Multi-tab sync leadership

**CSH-MESH-5:** When `isSyncLeader === false` and user opens Human panel with active call session in another tab, UI **SHALL** show prompt: “Call active in another tab” with **Switch to this tab** (`claimSyncLeadership()`).

**CSH-MESH-6:** Follower tab **SHALL NOT** show stale participant counts as authoritative; **SHOULD** show “Sync paused — switch tab for live call.”

### 5.4 Tab background and keepalive

**CSH-MESH-7:** `useCallDocumentKeepalive` **SHALL** request screen wake lock only when: call active **AND** (`document.hidden` **OR** document PiP open).

**CSH-MESH-8:** Wake lock **SHALL** release when tab becomes visible and PiP is closed.

### 5.5 Token refresh during call

**CSH-MESH-9:** `MatrixProvider` **SHALL** continue deferring client recycle while `isGroupCallSessionActive()` (existing). Add integration test or manual QA step: token refresh mid-call does not drop `GroupCall`.

---

## 6) Human panel discoverability (CSH-DISCOVER)

### 6.1 Join invitation modal (spec §1.2.2 — not yet implemented)

**CSH-DISCOVER-1:** Implement [voice-video-call-implementation-spec.md §1.2.2](./voice-video-call-implementation-spec.md) join invitation modal:

- Opens once per join opportunity (`showRoomCallInProgress` false → true for `roomId`)
- Primary: Join with audio; Secondary: Join with video; Tertiary: Not now
- Throttled dismissal key in session storage
- i18n all locales

### 6.2 Signal deep-link auth retry

**CSH-DISCOVER-2:** When signal thread deep-link lookup fails and auth token is not yet available, **SHALL** retry resolution with backoff (max 3 attempts, 500ms / 1.5s / 4s) before surfacing error toast.

**CSH-DISCOVER-3:** Error copy **SHALL** distinguish auth-not-ready vs signal-not-found.

---

## 7) Recording and transcription stability (CSH-RECORD)

### 7.1 Client capture (current non-default path)

**CSH-RECORD-1:** `createCallRecording()` lazy `resolveGroupCall()` **SHALL** re-bind feeds on `UserMediaFeedsChanged` and `ScreenshareFeedsChanged` while recording is active.

**CSH-RECORD-2:** If compositor cannot produce ≥1 track within 10s of capture start, **SHALL** set `recordingStatus: 'error'` with actionable copy; **SHALL NOT** silently record audio-only without user notice when video was expected.

**CSH-RECORD-3:** Upload retry (`canRetryRecordingUpload`) **SHALL** persist pending upload metadata in `sessionStorage` until success or explicit discard (survive soft navigation within session).

**CSH-RECORD-4:** Limits from `call-recording-limits.ts` **SHALL** remain enforced; warn at 80%, critical at 90% of duration and size.

### 7.2 SFU egress (primary path — ADR 0001)

**CSH-RECORD-5:** Large calls (tier L+) **SHALL NOT** rely on client canvas compositor. Server egress **SHALL** be the recording source when SFU epic ships.

**CSH-RECORD-6:** `callSessionId` from `useSpaceGroupCall` **SHALL** correlate SFU egress artifacts with `space_call_recordings` / ingest API.

---

## 8) Large-audience SFU epic (CSH-SFU) — specification stub

Out of scope for mesh hardening PRs; **SHALL** be tracked as separate epic.

| Requirement | Description |
| ----------- | ----------- |
| **CSH-SFU-1** | Enable `useLivekitForGroupCalls: true` + `livekitServiceURL` in `matrix-provider.tsx` behind feature flag |
| **CSH-SFU-2** | Matrix handles membership/signaling; LiveKit handles media |
| **CSH-SFU-3** | Active speaker + simulcast: decode dominant speaker + filmstrip, not full mesh |
| **CSH-SFU-4** | Optional receive-only “viewer” role for audience |
| **CSH-SFU-5** | Server-side recording egress replaces client compositor for tier L+ |
| **CSH-SFU-6** | Target: **50+ participants** (product-defined) with <5s p95 join time on broadband |

Reference: [voice-video-call-matrix-tech-spec.md Option C](./voice-video-call-matrix-tech-spec.md).

---

## 9) Observability and QA (CSH-QA)

### 9.1 Dev telemetry

**CSH-QA-1:** Retain dev-only `[hypha.group_call]` logs (`space-group-call-telemetry.ts`) for join latency, leave reason, error codes.

**CSH-QA-2:** **SHOULD** add optional `localStorage` debug flag `hypha.callDebug=1` to enable `MEDIA_SNAPSHOT_INTERVAL_MS` feed vs participant snapshots in production support sessions (no PII in logs).

### 9.2 Manual QA script (required before each phase merge)

| # | Scenario | Pass criteria |
| - | -------- | ------------- |
| 1 | Banner + dock | In call with dock open: sidebar banner shows participant count + leave |
| 2 | Share handoff | A presents → B takeover → layout stable through warming → B presents |
| 3 | Join idle | Browser B sees join strip; joins same session as A |
| 4 | Stall recover | Simulate slow peer: stall banner → retry or auto-recover by 70s |
| 5 | Multi-tab | Call in tab 1; open tab 2 → prompt to claim leadership |
| 6 | Recording | Start capture → stop → upload succeeds or retry offered |
| 7 | Mobile | Viewport <768px: share policy per §4.3; no stuck presenter state |
| 8 | Deep link | Signal URL before auth ready: retries, then resolves |

### 9.3 Automated tests

| Area | Test type | File / note |
| ---- | --------- | ----------- |
| Share layout pure functions | Unit (vitest) | `call-stage-share-layout.test.ts` |
| Chrome visibility flags | Unit or component | Mock `showFloatingDock` / `showSidebarCallChrome` |
| WebRTC media | Manual only | Playwright cannot assert real media (document in plan) |

---

## 10) Traceability matrix

| ID | Phase | Primary files |
| -- | ----- | ------------- |
| CSH-CHROME-* | P0–P1 | `human-right-panel.tsx`, `global-call-dock-overlay.tsx`, `global-call-dock-context.tsx` |
| CSH-SHARE-* | P0–P2 | `call-stage-share-layout.ts`, `human-chat-panel-call-stage.tsx`, `use-space-group-call.ts`, `screenshare-takeover.ts` |
| CSH-MESH-* | P2–P3 | `use-space-group-call.ts`, `matrix-tab-leader.ts`, `use-call-document-keepalive.ts`, `matrix-provider.tsx` |
| CSH-DISCOVER-* | P1 | `human-right-panel.tsx`, join modal (new), `use-call-join-chime.ts` |
| CSH-RECORD-* | P3–P4 | `call-recording.ts`, `use-space-group-call.ts` |
| CSH-SCALE-* | P1, P5 | `call-gallery-grid.ts`, new warning banner component |
| CSH-SFU-* | P5 | `matrix-provider.tsx`, new LiveKit integration package |
| CSH-QA-* | All | Test files, runbook additions |

---

## 11) Out of scope

- Coherence-mode (`mode === 'coherence'`) call UI unless extended explicitly
- Thread-isolated calls (parallel calls per Signal in same Space)
- E2E encrypted group calls (`useE2eForGroupCall: true`) on SDK v40
- Legal/consent workflow beyond existing capture consent banner (product follow-up)

---

## 12) References

- PR #2284 — hotfix branch `fix/call-banner-regression`
- PRs #2273, #2275, #2276 — tightening regressions (May 2026)
- `packages/core/src/matrix/client/hooks/use-space-group-call.ts`
- `packages/epics/src/common/human-chat-panel/call-gallery-grid.ts`
- `packages/core/src/assets/call-recording-constants.ts`
