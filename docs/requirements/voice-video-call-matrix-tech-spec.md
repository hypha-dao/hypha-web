# Technical specification — Voice and video call for Signal threads (Matrix)

## Document control

| Field | Value |
|-------|--------|
| **Status** | Architecture & requirements — **implementation:** [voice-video-call-implementation-spec.md](./voice-video-call-implementation-spec.md) — **plan & quality bar:** [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md) — **Phase 0:** [voice-video-call-phase-0-runbook.md](./voice-video-call-phase-0-runbook.md) |
| **Scope** | Enable **audio and video calling** initiated from a **Signal** conversation in a **Space**, using **`matrix-js-sdk@^40.0.0`** and Hypha’s existing **Space = Room**, **Signal = Thread** mapping |
| **Normative references** | [Matrix JS SDK `MatrixClient`](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html), [`GroupCall`](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html), [`ICreateClientOpts`](https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ICreateClientOpts.html); Hypha: [`hypha-matrix-mapping.md`](../../.agents/references/domain/hypha-matrix-mapping.md) |
| **SDK version constraint** | Remain on **`matrix-js-sdk@^40.0.0`**; do **not** upgrade to v41+ in Next.js until the project-wide “multiple entrypoints” issue is resolved (see existing chat requirements and matrix engineer role). |

---

## 1) Problem statement

Product wants **voice and video** entry points (e.g. header actions in the Signal thread view) so participants can converse **in the context of a specific Signal** while staying **inside the Space**.

In Matrix:

- **VoIP signaling and media** are defined around **rooms** (and optionally **widgets / external SFUs**), not around **per-thread** media sessions in the spec sense.
- Hypha maps **Signal → `matrix.Thread`** inside the Space’s **`matrix.Room`**. Threads are excellent for **message** scoping; they are **not** a first-class VoIP isolation primitive in `matrix-js-sdk` the same way they are for timeline messages.

So the engineering task is to choose an architecture that is **honest about Matrix capabilities**, **fits Hypha’s domain mapping**, and meets **product expectations** (who hears whom, where the call “lives”, and how invites work).

---

## 2) What the Matrix JS SDK provides (v40)

The SDK exposes a **full VoIP / WebRTC stack** tied to **`MatrixClient`** and **`Room`**, not to **`Thread`**.

### 2.1 Client configuration (`createClient` / `ICreateClientOpts`)

Relevant options (see [ICreateClientOpts](https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ICreateClientOpts.html)):

| Option | Purpose |
|--------|---------|
| **`disableVoip`** | Default VoIP **on**; set `true` only if the product must disable TURN fetch and VoIP entirely. |
| **`forceTURN`** | Force relay via TURN (stricter NAT/firewall behavior). |
| **`fallbackICEServerAllowed`** | Allow SDK fallback ICE if the homeserver offers none. |
| **`iceCandidatePoolSize`** | Pre-gather candidates for faster setup (privacy/battery tradeoff). |
| **`useE2eForGroupCall`** | Encrypt **to-device** signaling for group calls where supported. Keep **false** on `matrix-js-sdk@40.x`; its Rust crypto path throws `Unimplemented` for encrypted group-call VoIP signaling. |
| **`useLivekitForGroupCalls`** | If **true**, the SDK **does not** establish WebRTC media for group calls; it creates **signaling** only so the app can attach **LiveKit** (or similar) for media. |
| **`livekitServiceURL`** | Service URL used when integrating LiveKit-style flows. |
| **`isVoipWithNoMediaAllowed`** | Allow joining group call **without** local A/V (interpretation per SDK docs). |

**Implication for Hypha:** today’s `MatrixProvider` builds the client with **only** `baseUrl`, `accessToken`, `userId`, `deviceId` (`packages/core/src/matrix/client/providers/matrix-provider.tsx`). A VoIP rollout **must** revisit `createClient` options (at least VoIP-related flags and, if using LiveKit, `useLivekitForGroupCalls` + URLs).

### 2.2 `MatrixClient` VoIP / group-call surface

From the public API (see [MatrixClient](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html)):

| Capability | Notes |
|------------|--------|
| **`createCall`** | **1:1 / legacy call** flow (room-based signaling; WebRTC handled by SDK). |
| **`createGroupCall`**, **`getGroupCallForRoom`** | **Multi-party / group call** model bound to a **`Room`**. |
| **`waitUntilRoomReadyForGroupCalls`** | Readiness gate before entering group calls (room state / capabilities). |
| **`getTurnServers`** / TURN expiry | ICE / relay; required for reliable NAT traversal. |
| **`matrixRTC`** | Newer RTC-related client surface (check current SDK docs for exact capabilities in v40). |
| **Flags** | `disableVoip`, `useLivekitForGroupCalls`, `livekitServiceURL`, `canSupportVoip`, etc. |

### 2.3 `GroupCall` (multi-party)

[`GroupCall`](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html) is constructed with `(client, room, type, …)` — explicitly **`Room`-scoped**. It exposes **`enter`**, **`leave`**, **`terminate`**, participant maps, local feed control (`setMicrophoneMuted`, `setLocalVideoMuted`, **`setScreensharingEnabled`** / **`screenshareFeeds`**), and optional **LiveKit** URL updates.

**There is no `Thread` parameter** on `GroupCall`: **group calls are not modeled as sub-room thread resources** in this API.

**UI mapping:** A full **SDK capability → layout/control** matrix (mic, camera, **screen share**, feeds, optional PTT/stats) is in the implementation spec **§2.4, §3.4.4, and §3.5** of [voice-video-call-implementation-spec.md](./voice-video-call-implementation-spec.md) — the latter also defines **in-app full view** (enlarged stage in a **modal**; not Matrix-specific) and, for **idle** members, a **proposed** **join alert** (chime + invitation modal) in **§1.2** (pure client; **not** a Matrix event — `GroupCall` discovery unchanged).

### 2.4 Threads vs VoIP (Hypha mapping impact)

Per [Hypha ↔ Matrix mapping](../../.agents/references/domain/hypha-matrix-mapping.md):

| Hypha | Matrix | VoIP relevance |
|-------|--------|----------------|
| Space | Room | **Native** scope for Matrix calls. |
| Signal | Thread | **Messaging** scope; **not** a native VoIP container in `matrix-js-sdk`. |

**Conclusion:** “Call inside this thread” is a **product interpretation**. The SDK will still implement signaling for **`roomId`** (and optionally correlate **thread context in app state** or via **custom timeline events**).

### 2.5 Implementation handoff

Normative file paths, API shape, UI placement, i18n keys, and acceptance criteria for engineers are in **[voice-video-call-implementation-spec.md](./voice-video-call-implementation-spec.md)**.

Phased **step-by-step plan**, **world-class** acceptance criteria (quality + UX), and **recording / transcript** (organizational memory in the Space) are in **[voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md)**.

---

## 3) Architecture options (no implementation commitment)

Choose **one** primary model (secondary patterns may coexist for edge cases).

### Option A — **Room group call + thread context (recommended baseline)** — **SELECTED for v1**

- **Media & signaling:** `GroupCall` (or successor RTC APIs) on the **Space’s Matrix `roomId`**.
- **Product semantics:** When the user taps **Call** from a **Signal** view, the UI passes **`threadRootEventId`** (and room id) into a **CallSession** controller that:
  - Ensures **`waitUntilRoomReadyForGroupCalls`** (or equivalent) succeeds.
  - Creates or joins **`getGroupCallForRoom` / `createGroupCall`** for that **room**.
  - Optionally posts an **`m.room.message`** (or `m.notice`) **in the thread** (“Started a call”) so the **thread timeline** shows intent and deep-link context — **without** claiming a separate Matrix VoIP “thread call” object.

**Pros:** Uses SDK-supported **group WebRTC** path; matches Element-style **room calls**.  
**Cons:** Technically **room-visible** to members who are not in the thread UI unless additional access rules exist (membership is still the **room**).

### Option B — **1:1 `createCall` between two participants**

- For **DM-style** use inside a space, initiate **`createCall`** to another `userId` with signaling in the **room** (exact invite semantics depend on server + SDK version).

**Pros:** Good for **two-person** signal review.  
**Cons:** Does not generalize to **group** signal threads without multiple peer connections or moving to group calls.

### Option C — **LiveKit (or other SFU) + Matrix signaling only**

- Set **`useLivekitForGroupCalls: true`** and supply **`livekitServiceURL`**; implement media with **LiveKit** client SDK while Matrix handles **membership + signaling**.

**Pros:** Scalable large calls, server-side mixing/recording options.  
**Cons:** Additional infrastructure, auth to LiveKit, and **more application code**; still **room-scoped** in Matrix.

### Option D — **Dedicated “call room” per Signal (parallel room)**

- Create or reuse a **child room** (space-per-call or signal-per-call) for VoIP only.

**Pros:** Hard isolation from main timeline noise.  
**Cons:** **Major** product/backend change (room lifecycle, invites, Matrix room count); likely **out of scope** unless security/compliance demands it.

### Decision record (to fill before coding)

| Question | Must answer |
|----------|-------------|
| **Who may join?** | All **space members**, or only those “following” the signal / thread? |
| **Room vs thread visibility** | Is a call **visible** only in the Signal UI, or is it a **space-wide** call? |
| **Group vs 1:1** | Minimum **N** participants for v1? |
| **E2EE** | Required for call metadata and media? (`useE2eForGroupCall`, server features) |
| **Server** | Homeserver must expose **VoIP-compatible** behavior (TURN, versions, unstable features). |

---

## 4) Next.js / Hypha integration architecture

### 4.1 Client-only boundary

- **`getUserMedia`**, **`RTCPeerConnection`**, and VoIP state **must not** run on the server. Use **client components** only (pattern already used for `MatrixProvider` — `'use client'`).
- Keep **`matrix-js-sdk`** as a **single bundled path** for the browser (see `apps/web/next.config.ts` **serverExternalPackages** and alias notes — already project-specific).

### 4.2 Suggested module boundaries

| Layer | Responsibility |
|-------|------------------|
| **`MatrixProvider` (extend or wrap)** | Expose **optional** VoIP-safe client config; avoid SSR VoIP. |
| **`useSignalCallSession` (new, future)** | Owns **lifecycle**: idle → requesting permissions → joining → connected → leaving; holds **`roomId` + `threadRootEventId`**. |
| **UI: Signal header** | Triggers **audio** vs **video** intent; shows consent + error states. |
| **Optional: timeline correlation** | Post thread message when call starts/ends (product decision). |

### 4.3 Observability & UX

- Expose **clear errors** for: permission denied, no TURN, unsupported server, unsupported room version, and **concurrent call** in the same room.
- Consider **idle / tab background** behavior (browser throttling of media).
- **Join attention (client-only):** Optional **ring** + **modal invitation** for users **not** yet in the room’s `GroupCall` — see [implementation spec §1.2](./voice-video-call-implementation-spec.md) (throttled; respects autoplay and user settings). Does **not** add Matrix signaling beyond existing participant sync.

---

## 5) Requirements (traceable)

### 5.1 Functional

| ID | Requirement |
|----|----------------|
| **FR-1** | From a **Signal thread** view inside a **Space**, the user SHALL be able to start an **audio** and/or **video** call using **`matrix-js-sdk`** VoIP capabilities **without** upgrading the SDK beyond **`^40.0.0`** unless a separate platform epic approves. |
| **FR-2** | The implementation SHALL treat **Matrix `Room` = Hypha Space** as the **only** supported scope for **native** `GroupCall` / `createCall` signaling (see §2.4). |
| **FR-3** | The UI SHALL accept a **`threadRootEventId`** (Signal identity) for **context** (which signal initiated the call) even if the underlying VoIP session is **room-scoped**. |
| **FR-4** | When a call is active, the user SHALL be able to **mute** microphone and **disable** camera per **`GroupCall`** capabilities (or documented equivalent). |
| **FR-5** | The system SHOULD post a **thread-visible** timeline event (e.g. notice) when a call starts/ends **if** product wants thread history to reflect calls (optional — confirm). |

### 5.2 Non-functional

| ID | Requirement |
|----|----------------|
| **NFR-1** | **Privacy:** Document whether call participation is **room-wide** or **thread-participant-only** (product + legal). |
| **NFR-2** | **Reliability:** TURN MUST be available for typical corporate NATs (`getTurnServers` / HS config). |
| **NFR-3** | **Security:** Align with Matrix **E2EE** posture for group calls (`useE2eForGroupCall`) and threat model for **LiveKit** if Option C is chosen. |
| **NFR-4** | **Performance:** Avoid duplicate `matrix-js-sdk` bundles; respect existing Next.js **external** config. |

---

## 6) Open risks & dependencies

1. **Semantic gap:** “Call **in** thread” vs “call **for** thread participants” — must be resolved in product; Matrix implements **room** calls.
2. **Homeserver capability:** VoIP requires a server that supports the needed **VoIP / RTC** features and **TURN**.
3. **SDK evolution:** **`matrixRTC`** and group-call APIs evolve; lock requirements to **v40** behavior until upgrade epic lands.
4. **Element parity:** Element Web’s calling stack is a useful **reference implementation** but not a drop-in; Hypha still owns UI and lifecycle.

---

## 7) Verification checklist (for a future implementation PR)

- [ ] `createClient` opts reviewed for VoIP; `disableVoip` is **false** in production builds that support calling.
- [ ] TURN servers resolve; ICE connectivity verified on a constrained network.
- [ ] Group call enters/leaves without leaking streams (dispose tracks on unmount).
- [ ] Signal header passes **`threadRootEventId`** into session state and optional timeline notice.
- [ ] Automated tests: **unit** for state machine; **manual** test script for WebRTC (Playwright often cannot assert real media — document limitations).

---

## 8) References

- Matrix JS SDK: [MatrixClient](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html), [GroupCall](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html), [ICreateClientOpts](https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ICreateClientOpts.html)
- Matrix specification: Client-Server API — **Voice over IP** (see current stable spec index at [spec.matrix.org](https://spec.matrix.org/latest/))
- Hypha domain mapping: [`.agents/references/domain/hypha-matrix-mapping.md`](../../.agents/references/domain/hypha-matrix-mapping.md)
