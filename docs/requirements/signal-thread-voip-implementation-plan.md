# Implementation plan — Space audio/video calls (world-class UX)

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready to execute (phased) |
| **Specs** | [signal-thread-voip-matrix-tech-spec.md](./signal-thread-voip-matrix-tech-spec.md), [signal-thread-voip-implementation-spec.md](./signal-thread-voip-implementation-spec.md) |
| **Media storage alignment** | Implementations of **recording** and **artifact URLs** SHALL follow the Hypha **space media storage** design. **Reference:** [Cursor agent / branch — space media storage](https://cursor.com/agents/bc-31e34c30-45d0-4f7a-b00b-9a6f46346b06?branch=cursor%2F-bc-31e34c30-45d0-4f7a-b00b-9a6f46346b06-b1a4) (use this as the source of truth for buckets, paths, signed URLs, and DB linkage to `spaces`). If that document moves, replace the link in a follow-up commit. |

---

## 1) Guiding principles

1. **Ship in vertical slices** — Each phase leaves the app in a demoable, testable state.
2. **Quality first** — “World-class” means **reliable connectivity** (TURN, ICE), **predictable UX** (clear states, recovery), and **measurable** metrics (join time, packet loss visibility in dev) before cosmetic polish alone.
3. **Space = Matrix room** — All VoIP signaling stays on the Space’s **`roomId`**; Signal/thread id is **context** only (see existing specs).
4. **Organizational memory** — **Transcripts** (and later **recordings**) are **first-class space assets**, not only Matrix timeline events.

---

## 2) Step-by-step implementation plan

### Phase 0 — Prerequisites and environment

| Step | Action | Done when |
|------|--------|-----------|
| 0.1 | Confirm **homeserver** supports Matrix VoIP / group calls and **TURN** (or `getTurnServers` returns usable ICE servers). | Document HS version + VoIP checklist in runbook. |
| 0.2 | Staging: **two browsers**, two users, same Space — verify **TURN** path (e.g. force relay in dev to simulate strict NAT). | ICE connected; audio heard both ways. |
| 0.3 | Lock **`matrix-js-sdk@^40`** in all consumers; **no v41** in Next until platform upgrade (existing project rule). | CI / dependency review passes. |
| 0.4 | Review **CSP** and headers for `getUserMedia`, workers if any, and **media** domains used later for recording. | Security sign-off note in PR. |

### Phase 1 — Core client: `createClient` + `useSpaceGroupCall`

| Step | Action | Done when |
|------|--------|-----------|
| 1.1 | Extend **`matrix-provider.tsx`** `createClient` with VoIP options per [implementation spec §2.1](./signal-thread-voip-implementation-spec.md). | `disableVoip: false`; explicit opts in code comments. |
| 1.2 | Add **`use-space-group-call.ts`** (or equivalent) implementing **`waitUntilRoomReadyForGroupCalls` → get/create `GroupCall` → `enter` / `leave`**; expose **`callState`**, **`callKind`**, mute/camera/screenshare as per spec. | Unit tests with mocked `MatrixClient`; no duplicate `GroupCall` per `roomId`. |
| 1.3 | Export hook from **`@hypha-platform/core`** barrel. | Epics can import without deep paths. |

### Phase 2 — UI shell: entry points + banner + audio-first

| Step | Action | Done when |
|------|--------|-----------|
| 2.1 | **`human-chat-panel-call-toolbar.tsx`**: tabs row + **phone / video / search** (search stub OK). | Matches **§3.1** layout; a11y labels. |
| 2.2 | **`human-chat-panel-call-banner.tsx`**: space-wide copy, **Leave**, **Mute**, connecting state. | User can start **audio** call and leave cleanly. |
| 2.3 | Wire **`human-right-panel.tsx`** (`mode === 'space'`) with `roomId` + hook. | **No** video stage required yet for **audio-only** path. |
| 2.4 | **i18n** keys for call strings (all locales). | No hard-coded English in UI components. |

### Phase 3 — Video + stage (top-tier in-call layout)

| Step | Action | Done when |
|------|--------|-----------|
| 3.1 | **`human-chat-panel-call-stage.tsx`**: render **`userMediaFeeds`** / participant tiles; **local PiP**; **avatar fallback** for audio-only tiles. | Two-user video call visible; PiP does not cover tabs. |
| 3.2 | **Camera mute** syncs UI + SDK **`setLocalVideoMuted`**. | Toggling does not drop call. |
| 3.3 | **Responsive** behavior: narrow panel stacks stage + messages; no horizontal scroll for tiles. | Design review on sm/md breakpoints. |

### Phase 4 — Screen share + advanced controls

| Step | Action | Done when |
|------|--------|-----------|
| 4.1 | Wire **`setScreensharingEnabled`**; render **`screenshareFeeds`** per **§3.5** (prominent share tile). | Local + remote screen visible; **Stop share** works. |
| 4.2 | Optional: **active speaker** highlight if SDK provides stable signal. | Visual ring or border on tile. |

### Phase 5 — Quality bar (“world-class” hardening)

| Step | Action | Done when |
|------|--------|-----------|
| 5.1 | **Error matrix** — permission denied, HS not ready, WebRTC failed, tab background: each has **copy + recovery** (retry leave/rejoin where safe). | UX review checklist signed. |
| 5.2 | **Performance** — avoid unnecessary re-renders on `GroupCall` events; profile stage with 4+ tiles if feasible. | No obvious jank on mid-range laptops. |
| 5.3 | **Telemetry** (privacy-safe): join latency, leave reason, optional **getGroupCallStats** in dev builds. | Dashboard or logs in staging only. |
| 5.4 | **Accessibility** — keyboard path to Leave/Mute; focus trap policy in modal; reduced motion preference for heavy animations. | axe / manual pass. |

### Phase 6 — Recording & transcript (organizational memory)

| Step | Action | Done when |
|------|--------|-----------|
| 6.1 | **Architecture decision** — Matrix **`GroupCall` alone does not provide** server-side recording/transcription. Choose: **(A)** SFU add-on (e.g. LiveKit / vendor) with ** egress** to object storage, or **(B)** client-side capture + upload (limited, not recommended for “world-class”). Document ADR. | ADR merged; linked from this plan. |
| 6.2 | **Transcript storage** — Implement **§10** (Postgres + space FK, RLS, link to `space_id` / `web3SpaceId` as per app conventions). | API returns transcripts scoped to Space membership; search/indexing follow-up optional. |
| 6.3 | **Recording storage** — Align **artifact** upload and **metadata** rows with [space media storage reference](#document-control) (bucket paths, signed URLs, retention). | Recording playable from Space UI; access matches Space permissions. |
| 6.4 | **UI** — Space **Call history** or **Memory** subsection: list recordings + transcripts with **speakers**, **timestamps**, **language**. | Product sign-off on IA. |

**Phases 1–3** deliver **in-app calling**; **Phase 6** may run **in parallel** after 6.1 once ADR is fixed.

---

## 3) Acceptance criteria — world-class quality & top-tier UX

These criteria **supplement** §7 of the [implementation spec](./signal-thread-voip-implementation-spec.md). All must be satisfied for the epic to be considered **complete** for “production-grade” calling.

### 3.1 Functional (calling)

- [ ] Users can start **audio** and **video** calls from the **Space** chat panel while authenticated to Matrix.
- [ ] **Second and subsequent participants** in the same Space can **join** and **leave** without desyncing the room.
- [ ] **Mute**, **camera off**, **leave** work reliably; **no** leaked `MediaStream` after leave or navigation away.
- [ ] **Screen share** works when in scope (see spec §3.5), including **stop** and **error** paths for display capture.

### 3.2 Quality (media & connectivity)

- [ ] **TURN** verified: calls succeed on **restrictive NAT** / corporate-style networks (staging proof with forced relay or documented test).
- [ ] **Audio** is intelligible in two-party and small-group tests; **no** sustained one-way audio without clear UI error.
- [ ] **Video** maintains usable frame rate under normal load; **degradation** (e.g. low bandwidth) is **graceful** (frozen tile indication or SDK-appropriate behavior), not silent failure.
- [ ] **Latency** subjectively acceptable for conversation (no systematic multi-second delay in staging tests).

### 3.3 UX (top-tier)

- [ ] **Clear states**: idle → connecting → connected → leaving; **no** ambiguous “stuck” UI without a **Retry** / **Leave** path.
- [ ] **Honest copy**: users understand the call is **space-wide**, not thread-private.
- [ ] **Internationalization**: all strings via **`HumanChatPanel.*`** (or agreed namespace).
- [ ] **Accessibility**: keyboard operable controls for critical actions; visible focus; screen reader labels for call state changes.
- [ ] **Resilience**: tab background / focus loss does not leave orphan streams without recovery path.

### 3.4 Engineering

- [ ] **`matrix-js-sdk` single bundle** path preserved (`next.config` / no duplicate entrypoints).
- [ ] **No VoIP** on server components; secrets never in client.
- [ ] **Documentation**: runbook for HS requirements, TURN, and known limitations.

---

## 4) Recording & transcript — organizational memory

### 4.1 Scope

| Artifact | Purpose | Owner |
|----------|---------|--------|
| **Recording** | Replay of call **audio/video** (org knowledge, onboarding, compliance). | Product + infra |
| **Transcript** | **Searchable text** for organizational memory, AI, and audit. | Product + data |

**Matrix `GroupCall`** delivers **live media** and signaling; it does **not** by itself provide **durable recording** or **speech-to-text**. Those require **additional services** (see §2 Phase 6).

### 4.2 Storage principle — **in the Space**

Both **recording files** and **transcript content** SHALL be **stored and scoped to the Hypha Space** so they contribute to **organizational memory**:

- **Logical:** Every artifact has **`space_id`** (or equivalent FK to `spaces`) and **optional** link to **`thread_root_event_id`** / Signal id for context.
- **Physical:** **Media blobs** (video/audio files) follow the **space media storage** pattern (object storage path, encryption at rest, signed URL policy) as defined in the **[referenced Cursor agent / branch](https://cursor.com/agents/bc-31e34c30-45d0-4f7a-b00b-9a6f46346b06?branch=cursor%2F-bc-31e34c30-45d0-4f7a-b00b-9a6f46346b06-b1a4)** — implementers MUST reconcile field names and upload flow with that document when it lands on `main`.
- **Access control:** Read/write **same rules** as Space membership (and any elevated roles product defines). **No** public transcript URLs without explicit product decision.

### 4.3 Transcript — data model (normative direction)

Implementers SHALL define a **dedicated** persistence layer (example shape — adjust to match `storage-postgres` conventions):

| Field | Purpose |
|-------|---------|
| `id` | Primary key |
| `space_id` | FK → **Space** (organizational anchor) |
| `call_session_id` | Correlation id from SFU or app-generated UUID for the call |
| `language` | BCP-47 language of transcript |
| `text` or `segments` | Full text or **timestamped segments** (preferred for UX: speaker + time) |
| `source` | `e.g. stt_provider_name` |
| `created_at` | Ingestion time |
| `created_by` / `metadata` | Optional: Matrix user id, consent flags |

**Search:** Index for **full-text** search scoped to Space (Postgres `tsvector` or external search later).

### 4.4 Recording — data model (normative direction)

| Field | Purpose |
|-------|---------|
| `id` | Primary key |
| `space_id` | FK → Space |
| `call_session_id` | Same id as transcript row for the same event |
| `media_uri` or `storage_key` | Pointer to blob per **space media storage** spec |
| `duration_seconds` | For UI |
| `mime_type` | `video/webm` etc. |
| `created_at` | |

### 4.5 Pipeline (high level)

1. **Call lifecycle** event emits **`call_session_id`** (when recording/transcription enabled).
2. **STT** job runs on **audio** (from egress file or stream) — **async**; transcript row **updates** from `processing` → `ready`.
3. **UI** in Space shows **Transcript** and **Recording** in a **Calls** / **Memory** area with **permission** checks.

### 4.6 Legal / consent

- [ ] Jurisdiction-appropriate **consent** for recording and transcription (banner or join flow).
- [ ] **Retention** policy aligned with org settings (auto-delete after N days if required).

---

## 5) Traceability

| Artifact | Location |
|----------|----------|
| Architecture | [signal-thread-voip-matrix-tech-spec.md](./signal-thread-voip-matrix-tech-spec.md) |
| UI + SDK mapping | [signal-thread-voip-implementation-spec.md](./signal-thread-voip-implementation-spec.md) |
| Phasing + quality bar + memory | This document |

---

## 6) References

- Matrix JS SDK: [MatrixClient](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html), [GroupCall](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.GroupCall.html)
- Space media storage (external): [Cursor agent link](https://cursor.com/agents/bc-31e34c30-45d0-4f7a-b00b-9a6f46346b06?branch=cursor%2F-bc-31e34c30-45d0-4f7a-b00b-9a6f46346b06-b1a4)
- Hypha mapping: [`.agents/references/domain/hypha-matrix-mapping.md`](../../.agents/references/domain/hypha-matrix-mapping.md)
