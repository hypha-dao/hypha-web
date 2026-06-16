# Technical specification — Call / video world-class UX (Human panel)

## Document control

| Field | Value |
| ----- | ----- |
| **Status** | Ready to implement (spec only) |
| **Scope** | Nine production defects and UX gaps in the floating call dock, full-screen stage, screen share, reactions, media quality, session stability, and Document Picture-in-Picture (PiP) |
| **Parent specs** | [voice-video-call-matrix-tech-spec.md](./voice-video-call-matrix-tech-spec.md), [voice-video-call-implementation-spec.md](./voice-video-call-implementation-spec.md), [call-stability-hardening-spec.md](./call-stability-hardening-spec.md) |
| **Implementation plan** | [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md) (**single PR**) |
| **WCUX phase reference** | [call-world-class-ux-implementation-plan.md](./call-world-class-ux-implementation-plan.md) |
| **Regression plan** | [call-regression-test-plan.md](./call-regression-test-plan.md) |
| **CSH origin** | PR [#2285](https://github.com/hypha-dao/hypha-web/pull/2285) — merged into spec PR [#2297](https://github.com/hypha-dao/hypha-web/pull/2297) |
| **Architecture (v1)** | Matrix `GroupCall` mesh WebRTC (`useLivekitForGroupCalls: false`) |
| **Stakeholder evidence** | Screenshots attached to the originating request (2026-06-01/02) |

---

## 1) Problem statement

The Human panel call feature is functionally present but falls short of world-class conferencing apps (Zoom, Meet, Teams) in several user-visible ways:

| # | Symptom (stakeholder) | Severity |
| - | --------------------- | -------- |
| 1 | Screen-share tab/window audio not heard by others; remote viewers see a **Muted** badge on the share tile | P0 |
| 2 | Presenter's **voice is too quiet** while sharing screen | P0 |
| 3 | Full-screen dock: unbalanced grid with empty gaps; speaker does not expand to fill viewport; no Zoom-style threshold layouts | P1 |
| 4 | Medium/small dock: participant thumbnails **cropped** (heads cut off); inconsistent layout vs full-screen | P1 |
| 5 | Audio-only tiles: participant **name missing**; voice-wave colour is hard-coded emerald instead of **space accent** | P1 |
| 6 | No **reactions** or **raise hand** in call toolbar | P2 |
| 7 | Video appears **pixelated** / low quality | P1 |
| 8 | Participants **disconnected after ~40 minutes** | P0 |
| 9 | **Document PiP**: remote audio stops after opening PiP (regression) | P0 |

This document defines normative requirements (`WCUX-*`) traceable to code paths and acceptance tests.

---

## 2) Current implementation baseline (as of `main`)

| Area | Primary files | Notes |
| ---- | ------------- | ----- |
| Call controller | `packages/core/src/matrix/client/hooks/use-space-group-call.ts` | Mesh WebRTC, voice presets, active speaker, screenshare |
| Stage / tiles | `packages/epics/src/common/human-chat-panel/human-chat-panel-call-stage.tsx` | Gallery grid, share layout, `FeedContent` audio/video elements |
| Gallery math | `packages/epics/src/common/human-chat-panel/call-gallery-grid.ts` | Threshold `CALL_GALLERY_MIN_PARTICIPANTS = 4` |
| Floating dock | `packages/epics/src/common/global-call-dock-overlay.tsx` | Modes: `thumbnail` (480×320), `expanded` (640×420), `fullscreen` |
| PiP | `packages/epics/src/common/use-call-dock-document-pip.ts` | Chrome Document PiP API |
| Tab keepalive | `packages/epics/src/common/use-call-document-keepalive.ts` | Wake lock + silent AudioContext |
| Voice waves | `packages/epics/src/common/human-chat-panel/call-audio-voice-waves.tsx` | Uses `bg-emerald-*` / `bg-primary/80`, not `--space-accent` |
| Emoji (chat) | `packages/epics/src/common/human-chat-panel/human-chat-panel-emoji-*.tsx`, `emoji-mart-index.ts` | Reuse for call reactions |
| Matrix session | `packages/core/src/matrix/client/providers/matrix-provider.tsx` | In-call token refresh via `setAccessToken` when `isGroupCallSessionActive()` |

**Known code defects motivating this spec:**

1. **Share audio playback:** `FeedContent` renders `<audio>` only when `!feed.isLocal() && !isShare` — remote screenshare streams never attach to an audio element (`human-chat-panel-call-stage.tsx` ~2078).
2. **Share muted badge:** `feedReportsAudioMuted()` is applied to share tiles; share feeds typically have no microphone track, so UI shows **Muted** incorrectly.
3. **PiP audio:** PR #2284 merged the portal pattern (`pipWindow?.document.body ?? document.body`). Stakeholder reports PiP audio still failing in production — **verify on current `main`** during W1; implement `WCUX-PIP-*` if regression persists.
4. **Voice waves colour:** `call-audio-voice-waves.tsx` hard-codes emerald; space accent is available via `useSpaceAccentPortalStyles()` on the dock shell.

---

## 3) Layout model — viewport tiers and participant thresholds

### 3.1 Viewport tiers (dock chrome)

| Tier ID | Dock mode | Typical size | Layout engine |
| ------- | --------- | ------------ | ------------- |
| **V-S** | `thumbnail` | 480×320 (min) | Speaker + strip (see §3.3) |
| **V-M** | `expanded` | 640×420 | Speaker + strip or compact grid |
| **V-L** | `fullscreen` | viewport-filling overlay | Full layout engine (§3.2) |
| **V-PiP** | Document PiP | ~320×208 | Same rules as **V-S** with `density: compact` |

**WCUX-LAYOUT-0:** Layout selection **SHALL** be a **pure function** of `(viewportTier, participantDeviceCount, hasActiveShare, activeSpeakerKey, galleryPage)` implemented in a new module `call-stage-layout-engine.ts` (unit-tested). UI components **SHALL NOT** embed ad-hoc grid class strings beyond what the engine returns.

**WCUX-LAYOUT-1:** All tiers **SHALL** use **`object-fit: contain`** for participant camera tiles in **V-S** and **V-M** unless the tile is the sole occupant of the stage (then `cover` is allowed). This prevents head cropping (stakeholder images 4, 6, 8).

**WCUX-LAYOUT-2:** Empty grid cells **SHALL NOT** appear: when `N` participants do not fill the last row, remaining tiles **SHALL** expand (flex-grow) or the layout **SHALL** switch to speaker-primary mode (§3.3) instead of leaving white/black voids.

### 3.2 Full-screen (`V-L`) participant thresholds — Zoom-inspired

Let **N** = visible participant devices on the current gallery page (local + remote, excluding hidden presenter self-mirror).

| N | Layout mode | Grid / structure | Active speaker behaviour |
| - | ----------- | ---------------- | ------------------------ |
| **1** | `solo` | Single tile fills stage (`grid-cols-1`, flex-1) | N/A |
| **2** | `duo` | 1×2 or 2×1 by aspect (prefer side-by-side landscape) | Highlight border on speaker |
| **3** | `trio` | 2×2 with **one enlarged** speaker cell occupying 2 cells (L-shape), two thumbnails | Speaker cell **SHALL** track `GroupCall.activeSpeaker`; fallback: loudest `feed.isSpeaking()` |
| **4** | `quad` | 2×2 equal | Speaker ring only |
| **5** | `five` | 3×2 grid, **5 tiles** — last row **3 centered** (reuse `getCallGalleryTileColumnStart`) | Speaker ring |
| **6** | `six` | 3×2 full | Speaker ring |
| **7** | `seven` | 3×3 with **7 tiles** — speaker tile **2×2 center** or top-left 2×2 per Zoom gallery-of-7 pattern; remaining 5 as strip | Speaker promoted to enlarged cell |
| **8** | `eight` | 3×3 with **8 tiles** — one empty cell absorbed by enlarging speaker tile | Speaker promoted |
| **9–20** | `gallery` | Existing paginated gallery (`CALL_GALLERY_MAX_TILES_PER_PAGE = 20`) with **speaker strip** optional toggle | Active speaker **SHALL** auto-scroll into view on page containing them |
| **21+** | `speakerGallery` | **Primary:** large active speaker (≥68% width or height). **Secondary:** vertical filmstrip (≤32%) with paginated thumbnails (max 7 visible + “+N”) | Speaker switches on `ActiveSpeakerChanged` with 300ms crossfade |

**WCUX-LAYOUT-3:** When `hasActiveShare === true`, full-screen **SHALL** defer to share-first layout (existing `sideBySide` / `filmstrip` / `speakerTop` / `pip` modes) but participant band **SHALL** obey **V-S/M strip rules** when band has ≤3 tiles.

**WCUX-LAYOUT-4:** On `ActiveSpeakerChanged`, the enlarged speaker tile **SHALL** update within **500 ms** without resetting pagination unless the speaker moves to another gallery page.

**WCUX-LAYOUT-5:** Participant name labels **SHALL** remain fully visible (no vertical clip). Minimum label container height: **1.75 rem**; use `truncate` horizontally only.

### 3.3 Small / medium dock — speaker-primary strip

When `viewportTier ∈ {V-S, V-M, V-PiP}` and **N ≥ 2**:

| Condition | Layout |
| --------- | ------ |
| N = 2 | 65/35 split: active speaker left (or top in portrait), other participant thumbnail |
| 3 ≤ N ≤ 6 | Speaker ~70% + vertical strip of up to 5 others (scroll if needed) |
| N ≥ 7 | Speaker ~75% + strip showing 6 faces + “+{N−6}” badge opening full-screen |

**WCUX-LAYOUT-6:** `panelVideoFit` default for dock **SHALL** be `'contain'` for all multi-participant states in **V-S/M** (override current `'cover'` default in `global-call-dock-overlay.tsx` when passing props to `HumanChatPanelCallStage`).

**WCUX-LAYOUT-7:** Resize transitions between dock modes **SHALL** preserve active speaker selection and not reset gallery page.

---

## 4) Screen share audio (WCUX-SHARE-AUDIO)

### 4.1 Problem analysis

Stakeholder report: sharing a video tab/window — others hear no share audio and see **Muted** on the share tile.

Root causes in current code:

1. Remote share `<video>` is rendered but **no `<audio>`** element is bound to the share `MediaStream`.
2. UI treats share feed as mic-muted because `feed.isAudioMuted()` is true when no mic track exists on the share stream (tab audio is a separate track).

### 4.2 Capture (presenter client)

**WCUX-SHARE-AUDIO-1:** When enabling screenshare, the client **SHALL** request display media with **`audio: true`** where the browser supports it:

- Chrome / Edge: `{ video: true, audio: { suppressLocalAudioPlayback: false } }` via `getDisplayMedia` (Matrix SDK hook point or pre-flight in `enableLocalScreenshareDirect` / wrapper).
- Safari: best-effort; if user denies audio, show non-blocking toast: “Share audio unavailable in this browser — others may not hear your tab.”

**WCUX-SHARE-AUDIO-2:** If the user selects a surface without audio (Chrome checkbox unchecked), UI **SHALL** show persistent presenter hint: “Tab audio not shared” (i18n).

**WCUX-SHARE-AUDIO-3:** Presenter's **microphone track SHALL remain a separate user-media feed** during share; tab audio rides on the screenshare feed per WebRTC conventions.

### 4.3 Playback (viewer client)

**WCUX-SHARE-AUDIO-4:** `FeedContent` **SHALL** attach an `<audio autoPlay playsInline>` to **remote screenshare feeds** when `stream.getAudioTracks().length > 0`, mirroring camera feed audio handling.

**WCUX-SHARE-AUDIO-5:** Share tile **SHALL NOT** display the microphone **Muted** badge unless the presenter explicitly muted their mic (user-media feed), not based on share feed `isAudioMuted()`.

**WCUX-SHARE-AUDIO-6:** Share tile overlay label **SHALL** show `{presenterName} · {callScreenShare}` (i18n pattern).

### 4.4 Acceptance

| ID | Scenario | Pass |
| -- | -------- | ---- |
| A1 | A shares Chrome tab with audio; B hears tab sound | B confirms audio within 3 s |
| A2 | A shares without audio checkbox | B sees hint on A's client only; B does not see **Muted** on share tile |
| A3 | A shares YouTube; B hears video | No **Muted** badge on share tile |

---

## 5) Presenter voice priority during share (WCUX-SHARE-VOICE)

**WCUX-SHARE-VOICE-1:** While local user is screensharing, voice processing **SHALL** automatically apply preset **`voice_isolation`** (existing `constraintsForVoicePreset`) if current preset is `standard`, restoring previous preset when share stops.

**WCUX-SHARE-VOICE-2:** While screensharing, `autoGainControl` **SHALL** be `{ ideal: true }` on the mic track even in `voice_isolation` mode (override table in `constraintsForVoicePreset` when `isScreensharing`).

**WCUX-SHARE-VOICE-3:** Client **SHALL** set mic track `contentHint = 'speech'` and screenshare audio track `contentHint = 'music'` when supported.

**WCUX-SHARE-VOICE-4:** Optional (phase 2): apply Web Audio compressor on local mic before encode — only if measurable gain &lt; 6 dB without clipping.

**WCUX-SHARE-VOICE-5:** Settings menu **SHALL** expose helper text: “Voice boost active while presenting” when WCUX-SHARE-VOICE-1 applies.

---

## 6) Audio-only tile polish (WCUX-AUDIO-TILE)

**WCUX-AUDIO-TILE-1:** For camera-off tiles (`!showVideo && !isShare`), participant display name **SHALL** always render when `resolvedName` is non-empty; if empty after profile resolution timeout (**4 s**), **SHALL** fall back to Matrix display name / userId localpart (never blank).

**WCUX-AUDIO-TILE-2:** `useCallParticipantDisplayName` **SHALL NOT** suppress names for audio-only tiles during profile loading — show Matrix label immediately, swap to Hypha person name when loaded (no skeleton-only state without text).

**WCUX-AUDIO-TILE-3:** `CallAudioVoiceWaves` active bars **SHALL** use `--space-accent` (same token pattern as `human-chat-panel-capture-consent-banner.tsx` and fix branch `call-audio-voice-waves.tsx`):

```css
background: color-mix(in srgb, var(--space-accent, var(--color-accent-9)) 88%, white);
box-shadow: 0 0 10px color-mix(in srgb, var(--space-accent) 35%, transparent);
```

**WCUX-AUDIO-TILE-4:** Idle bars **SHALL** use `color-mix(in srgb, var(--space-accent) 25%, transparent)` on dark scrim.

**WCUX-AUDIO-TILE-5:** Dock **SHALL** continue passing space accent CSS variables into PiP window (`copyDocumentAppearance` already copies `--*` custom properties — verify `--space-accent` is on `:root` or dock shell).

---

## 7) In-call reactions and raise hand (WCUX-REACT)

Reuse Matrix annotation pattern from [group-chat-emoji requirements](./Features/group-chat-emoji/requirements.md).

### 7.1 Data model

**WCUX-REACT-1:** Call reactions **SHALL** use `m.reaction` annotation events targeting the **room active group-call marker event** (`org.matrix.msc3401.call` state) OR a dedicated **`m.room.message` call-session anchor** event emitted on join (implementation choice — document in PR; prefer anchor message with `m.call.reaction` custom relation for easier timeline scoping).

**WCUX-REACT-2:** Raise hand **SHALL** use `m.room.message` with `msgtype: m.notice` and custom field `io.hypha.call.raise_hand: true|false` **or** MSC3401 member state extension if available in SDK — v1: ephemeral room message aggregated client-side (last event per user wins).

**WCUX-REACT-3:** Events **SHALL** be scoped to the Space room (`roomId` of `GroupCall`), not thread — consistent with VoIP architecture.

### 7.2 UI — toolbar

**WCUX-REACT-4:** Add **React** control to `HumanChatPanelInCallControls` (between screen share and leave), opening popover patterned after Zoom reference:

| Section | Content |
| ------- | ------- |
| Quick reactions | 👏 👍 ❤️ 😂 😮 🎉 (configurable `CALL_QUICK_REACTIONS` constant) |
| More | Opens `HumanChatPanelEmojiMartSurface` (same dataset as chat composer) |
| Raise hand | Toggle ✋ — highlights when local user raised |
| Lower hand | Auto when user speaks (optional) or manual toggle |

**WCUX-REACT-5:** Incoming reactions **SHALL** animate as floating emoji on the sender's tile (2.5 s fade, max 3 concurrent per tile).

**WCUX-REACT-6:** Raised hands **SHALL** appear in: (a) tile badge ✋, (b) optional “Raised hands” strip above controls when count ≥ 1, sorted by timestamp.

**WCUX-REACT-7:** All strings **SHALL** be i18n keys under `HumanChatPanel.*` in en/pt/es/fr/de.

### 7.3 Permissions

**WCUX-REACT-8:** Users in the call **SHALL** send reactions; idle joiners **SHALL NOT** until joined.

---

## 8) Video quality (WCUX-QUALITY)

### 8.1 Send path (camera)

**WCUX-QUALITY-1:** On join with video enabled, camera capture **SHALL** request:

```typescript
video: {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 24, max: 30 },
  facingMode: 'user',
}
```

**WCUX-QUALITY-2:** When simulcast is available in `matrix-js-sdk@40` group calls, **SHALL** enable highest layer for ≤4 participants; degrade to mid layer for 5–8; lowest for 9+ (exact API per SDK capability audit in implementation PR).

### 8.2 Receive path

**WCUX-QUALITY-3:** `<video>` elements **SHALL** set `playsInline` and avoid upscaling beyond intrinsic frame width (CSS `max-width: 100%`, no scale transform &gt; 1).

**WCUX-QUALITY-4:** For thumbnail tiles in **V-S/M**, receiver **MAY** cap decoded resolution via `RTCRtpReceiver.setParameters` `scaleResolutionDownBy: 2` when N ≥ 5 (config flag `CALL_THUMBNAIL_DOWNSCALE` default true).

### 8.3 Diagnostics

**WCUX-QUALITY-5:** When `NEXT_PUBLIC_MATRIX_WEBRTC_DEBUG=1`, log `inbound-rtp` `frameWidth×frameHeight` per tile every 30 s (`group-call-webrtc-diagnostics.ts`).

### 8.4 Acceptance

| ID | Scenario | Pass |
| -- | -------- | ---- |
| Q1 | 2-person call, good network | ≥720p effective resolution reported in debug overlay |
| Q2 | 6-person gallery | Thumbnails may downscale; active speaker ≥480p |

---

## 9) Session stability — ~40 minute disconnect (WCUX-SESSION)

### 9.1 Hypothesis catalogue (to verify in implementation)

| Hypothesis | Mitigation requirement |
| ---------- | ---------------------- |
| Matrix access token TTL ~60 min; refresh fails mid-call | WCUX-SESSION-1 |
| Browser throttles background tab WebRTC | WCUX-SESSION-2 (extends CSH-MESH-7) |
| TURN allocation expiry | WCUX-SESSION-3 |
| `GroupCall` keep-alive / membership timeout | WCUX-SESSION-4 |
| Mesh renegotiation failure after idle | WCUX-SESSION-5 |

### 9.2 Requirements

**WCUX-SESSION-1:** `MatrixProvider.recoverMatrixSession` **SHALL** proactively refresh tokens at **`TTL − 10 min`** while `isGroupCallSessionActive()` (scheduled timer from token `expires_in` if exposed by `/api/matrix/token`, else fixed **25 min** interval during call).

**WCUX-SESSION-2:** On refresh success, **SHALL** call `existingClient.setAccessToken` + `retryMatrixClientSync` without recycling client (existing path — add proactive schedule).

**WCUX-SESSION-3:** On refresh failure, UI **SHALL** show blocking banner with **Reconnect** (calls `recoverMatrixSession`) before hard disconnect.

**WCUX-SESSION-4:** `useCallDocumentKeepalive` **SHALL** run for all active calls, not only when `document.hidden || documentPipOpen` — silent oscillator **MAY** remain conditional, but **wake lock** **SHALL** be held for entire call duration on supported browsers.

**WCUX-SESSION-5:** `useSpaceGroupCall` **SHALL** emit periodic `placeOutgoingCalls()` nudge every **15 min** while participant count &gt; 1 (extends existing retry schedule) to refresh pairwise paths.

**WCUX-SESSION-6:** Telemetry event `hypha.group_call.session_end` **SHALL** include `durationMs`, `reason`, `lastMatrixError`, `tokenRefreshCount` for post-mortem.

**WCUX-SESSION-7:** Manual QA **SHALL** include a **45-minute** so soak test before release (two browsers, mic open).

---

## 10) Document Picture-in-Picture audio (WCUX-PIP)

**WCUX-PIP-1:** Dock **SHALL** portal to **`document.body` on the main page** always; PiP window **SHALL** receive a **visual clone** or **secondary portal** that does not destroy main-document media nodes.

**Recommended approach (matches fix/call-banner-regression):**

```typescript
const portalTarget = pipWindow?.document.body ?? document.body;
return createPortal(dockContent, portalTarget);
```

When PiP open, **also** render hidden `aria-hidden` media sink in main document OR keep `FeedContent` audio elements mounted in main doc via `createPortal(..., document.body)` for media-only subtree.

**WCUX-PIP-2:** `useCallDocumentKeepalive(active, isDocumentPipOpen)` **SHALL** resume all `HTMLMediaElement.play()` on PiP open/close (`feed` audio refs — implement `resumeCallPlayback()` in call stage).

**WCUX-PIP-3:** Copy `--space-accent` and theme tokens into PiP document (existing `copyDocumentAppearance` — add test).

**WCUX-PIP-4:** Regression test (Vitest + manual): open PiP → remote audio continues → close PiP → audio continues.

---

## 11) Observability and QA (WCUX-QA)

### 11.1 Automated tests (Vitest)

| Area | File |
| ---- | ---- |
| Layout engine thresholds | `call-stage-layout-engine.test.ts` |
| Gallery empty-cell avoidance | extend `call-gallery-grid.test.ts` |
| Share audio muted badge logic | `call-feed-tile-label.test.ts` |
| PiP portal target | component test mock |

### 11.2 Manual QA script (required)

| # | Scenario | Pass |
| - | -------- | ---- |
| 1 | Tab share with audio (Chrome) | Remote hears audio; no false Muted on share |
| 2 | Presenter speaks while sharing | Listeners rate voice ≥ baseline (subjective) |
| 3 | 5-person full-screen | No empty grid cell; names visible |
| 4 | 7-person medium dock | Faces not cropped; speaker enlarged |
| 5 | Audio-only participant | Name visible; waves use space accent |
| 6 | Send 👍 reaction | Appears on sender tile + clears |
| 7 | Raise hand | ✋ visible to all; toggle off |
| 8 | 45-min call | No disconnect |
| 9 | Open/close Document PiP | Remote audio uninterrupted |

### 11.3 Playwright

WebRTC media cannot be asserted in CI; cover toolbar states, reaction popover open, raise-hand UI, layout DOM structure with mocked `useSpaceGroupCall`. See [call-regression-test-plan.md §4](./call-regression-test-plan.md).

---

## 12) Traceability matrix

| Stakeholder # | Requirement IDs | Primary files |
| ------------- | ----------------- | ------------- |
| 1 | WCUX-SHARE-AUDIO-* | `human-chat-panel-call-stage.tsx`, `use-space-group-call.ts` |
| 2 | WCUX-SHARE-VOICE-* | `use-space-group-call.ts` |
| 3 | WCUX-LAYOUT-* (V-L) | `call-stage-layout-engine.ts`, `human-chat-panel-call-stage.tsx`, `call-gallery-grid.ts` |
| 4 | WCUX-LAYOUT-* (V-S/M) | `global-call-dock-overlay.tsx`, `human-chat-panel-call-stage.tsx` |
| 5 | WCUX-AUDIO-TILE-* | `call-audio-voice-waves.tsx`, `human-chat-panel-call-stage.tsx` |
| 6 | WCUX-REACT-* | `human-chat-panel-in-call-controls.tsx`, `matrix-provider.tsx`, emoji modules |
| 7 | WCUX-QUALITY-* | `use-space-group-call.ts`, `matrix-webrtc-env.ts` |
| 8 | WCUX-SESSION-*, CSH-MESH-9 | `matrix-provider.tsx`, `use-call-document-keepalive.ts`, `use-space-group-call.ts` |
| 9 | WCUX-PIP-* | `global-call-dock-overlay.tsx`, `use-call-dock-document-pip.ts` |
| — | CSH-CHROME-*, CSH-DISCOVER-*, CSH-MESH-*, CSH-RECORD-*, CSH-SCALE-* | See [call-stability-hardening-spec.md §10](./call-stability-hardening-spec.md) |

---

## 13) Out of scope

- LiveKit / SFU migration (see CSH-SFU-* in call-stability spec)
- E2E encrypted group calls
- Coherence-mode call UI unless explicitly extended
- Server-side mix/min/max participant enforcement beyond UI warnings

---

## 14) References

- Stakeholder screenshots (2026-06-01/02) — call dock, gallery cropping, audio-only tile, reactions reference (Zoom)
- [call-stability-hardening-spec.md](./call-stability-hardening-spec.md) — `CSH-*` stability requirements (PR #2285)
- [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md) — single implementation PR plan
- [group-chat-emoji requirements](./Features/group-chat-emoji/requirements.md)
- PR [#2284](https://github.com/hypha-dao/hypha-web/pull/2284) — merged to `main`
- PR [#2285](https://github.com/hypha-dao/hypha-web/pull/2285) — stability spec (absorbed into #2297)
- Matrix display media: [MDN getDisplayMedia audio](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
