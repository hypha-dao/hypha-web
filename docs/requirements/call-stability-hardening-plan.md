# Implementation plan — Call stability hardening

## Document control

| Field | Value |
| ----- | ----- |
| **Status** | Reference (phased breakdown) — **implementation uses** [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md) |
| **Spec** | [call-stability-hardening-spec.md](./call-stability-hardening-spec.md) |
| **Companion spec** | [call-world-class-ux-spec.md](./call-world-class-ux-spec.md) |
| **Parent plans** | [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md) (Phases 1–6 baseline) |
| **Hotfix** | PR [#2284](https://github.com/hypha-dao/hypha-web/pull/2284) — **merged** to `main` |
| **Origin** | PR [#2285](https://github.com/hypha-dao/hypha-web/pull/2285) — absorbed into PR [#2297](https://github.com/hypha-dao/hypha-web/pull/2297) |

---

## 1) Guiding principles

1. **Build on merged baseline** — PR #2284 is on `main`; verify CSH-CHROME/SHARE before extending.
2. **Mesh honesty** — Document and UI-warn participant limits; do not market community-scale until SFU ships.
3. **Vertical slices** — Each phase leaves calling demoable with updated manual QA script (spec §9.2).
4. **One surface for video** — Sidebar OR dock stage, never duplicate takeover dialogs.
5. **Specs drive PRs** — Each implementation PR references `CSH-*` requirement IDs from the spec.

---

## 2) Phase overview

| Phase | Name | Goal | Depends on |
| ----- | ---- | ---- | ---------- |
| **P0** | Hotfix merge | Banner + share handoff regression fix | **Done** — #2284 merged |
| **P1** | Chrome & discoverability | Dock/sidebar contract guardrails, join modal, deep-link retry, scale warning | P0 |
| **P2** | Screen share hardening | Mobile policy, handoff QA, gallery reset tests | P0 |
| **P3** | Mesh reliability | Multi-tab UX, keepalive fix, stall copy, optional 20s pairwise retry | P0 |
| **P4** | Recording stability | Compositor feed refresh, upload persistence, error surfaces | P0 |
| **P5** | SFU / community calls | LiveKit integration, active speaker, server egress | ADR 0001, infra |
| **P6** | Observability | Debug flag, runbook, load-test notes | P1–P4 |

---

## 3) Phase 0 — Hotfix merge (PR #2284)

**Status:** **Merged to `main`.** Re-verify during consolidated implementation W1 smoke (see [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md) §W1).

| Step | Action | Spec IDs | Done when |
| ---- | ------ | -------- | --------- |
| 0.1 | Merge PR #2284 to `main` | CSH-CHROME-1–7, CSH-SHARE-1–3 | ✅ Merged |
| 0.2 | Verify CI on `main` | CSH-QA-* | All green |
| 0.3 | Run manual QA script rows 1–2 (spec §9.2) | CSH-QA-* | Re-run on consolidated branch before impl PR merge |

**Deliverables on `main`:**

- `showSidebarCallChrome` / `showSidebarCallVideo` split in `human-right-panel.tsx`
- Dock resume snapshot fields in `global-call-dock-context.tsx`
- `call-stage-share-layout.ts` + unit tests
- Feed batching after takeover in `use-space-group-call.ts`

---

## 4) Phase 1 — Chrome, discoverability, scale warnings

| Step | Action | Spec IDs | Done when |
| ---- | ------ | -------- | --------- |
| 1.1 | Add code comment + unit test guarding `showSidebarCallChrome` against `showFloatingDock` | CSH-CHROME-6 | Test fails if regression reintroduced |
| 1.2 | Implement join invitation modal (spec §1.2.2) | CSH-DISCOVER-1 | Modal opens once per join opportunity; i18n all locales |
| 1.3 | Signal deep-link auth retry with backoff | CSH-DISCOVER-2, CSH-DISCOVER-3 | Deep link resolves after auth without error flash |
| 1.4 | Participant count warning banner (default threshold: 12 devices) | CSH-SCALE-2 | Banner shows in sidebar + dock when over threshold |

**Files (expected touch):**

- `packages/epics/src/common/human-right-panel.tsx`
- `packages/epics/src/common/human-chat-panel/` (new modal component)
- `packages/i18n/src/messages/*.json`

**Acceptance:**

- [ ] Join modal: dismiss + “Not now” does not block join strip
- [ ] Scale warning: non-blocking; does not prevent join
- [ ] Chrome guard test in CI

---

## 5) Phase 2 — Screen share hardening

| Step | Action | Spec IDs | Done when |
| ---- | ------ | -------- | --------- |
| 2.1 | Product decision: mobile share policy (A/B/C from spec §4.3) | CSH-SHARE-5, CSH-SHARE-6 | Decision recorded in spec §4.3 table (selected option) |
| 2.2 | Implement selected mobile policy | CSH-SHARE-5, CSH-SHARE-6 | Manual QA row 7 passes |
| 2.3 | Expand `call-stage-share-layout.test.ts` for ghost/ended feeds | CSH-SHARE-1 | Coverage for all layout states in spec table |
| 2.4 | E2e smoke: share button visibility desktop vs mobile (UI only) | CSH-QA-3 | Playwright asserts control presence/absence |

**Files:**

- `packages/epics/src/common/human-chat-panel/human-chat-panel-in-call-controls.tsx`
- `packages/epics/src/common/global-call-dock-overlay.tsx`
- `packages/epics/src/common/human-chat-panel/call-stage-share-layout.ts`

**Acceptance:**

- [ ] Presenter handoff A→B stable on desktop (QA row 2)
- [ ] Mobile: no stuck “presenting” state when viewport shrinks (if policy B)

---

## 6) Phase 3 — Mesh reliability

| Step | Action | Spec IDs | Done when |
| ---- | ------ | -------- | --------- |
| 3.1 | Multi-tab prompt when follower detects active call | CSH-MESH-5, CSH-MESH-6 | User can claim leadership from Human panel |
| 3.2 | Fix wake lock: only when hidden + in call | CSH-MESH-7, CSH-MESH-8 | No wake lock on visible idle tab |
| 3.3 | Stall banner copy split: waiting vs connection problem | CSH-MESH-3, CSH-MESH-4 | i18n keys; UX review |
| 3.4 | Optional: 20s `placeOutgoingCalls` retry behind env flag | CSH-MESH-1 | Staging metrics show reduced stall rate (if enabled) |
| 3.5 | Manual QA: token refresh mid-call | CSH-MESH-9 | Document result in runbook |

**Files:**

- `packages/core/src/matrix/client/hooks/use-space-group-call.ts`
- `packages/core/src/matrix/client/matrix-tab-leader.ts`
- `packages/epics/src/common/use-call-document-keepalive.ts`
- `packages/epics/src/common/human-right-panel.tsx`

**Acceptance:**

- [ ] QA rows 4, 5, 8 pass
- [ ] No duplicate Matrix `/sync` on two tabs without user consent

---

## 7) Phase 4 — Recording stability

| Step | Action | Spec IDs | Done when |
| ---- | ------ | -------- | --------- |
| 4.1 | Compositor re-binds on feed change events during capture | CSH-RECORD-1 | Recording includes new camera after mid-call enable |
| 4.2 | 10s compositor start timeout with user-visible error | CSH-RECORD-2 | Error state shown; capture mode reset safely |
| 4.3 | Pending upload persistence in `sessionStorage` | CSH-RECORD-3 | Retry survives in-app navigation |
| 4.4 | QA row 6: full capture → upload → memory tile | CSH-RECORD-4, CSH-QA-* | End-to-end on staging |

**Files:**

- `packages/core/src/matrix/client/hooks/call-recording.ts`
- `packages/core/src/matrix/client/hooks/use-space-group-call.ts`

**Acceptance:**

- [ ] 90 min / 640 MB limits still enforced
- [ ] No second `getUserMedia` mic during Matrix call (existing guard preserved)

---

## 8) Phase 5 — SFU / community calls (epic)

**Prerequisite:** Infrastructure provisioning (LiveKit or vendor), ADR 0001 amend if vendor changes.

| Step | Action | Spec IDs | Done when |
| ---- | ------ | -------- | --------- |
| 5.1 | ADR amend or successor for chosen SFU vendor | CSH-SFU-1 | ADR merged |
| 5.2 | Feature flag `NEXT_PUBLIC_ENABLE_LIVEKIT_CALLS` | CSH-SFU-1 | Off by default |
| 5.3 | `createClient` LiveKit options + join path | CSH-SFU-2 | Staging: 2-user call via SFU |
| 5.4 | Active speaker UI (dominant + filmstrip) | CSH-SFU-3 | Tier L load test: 25 receive-only viewers |
| 5.5 | Server egress recording | CSH-SFU-5, CSH-RECORD-6 | Recording ingested via existing artifact API |
| 5.6 | Load test: 50 participants (product target) | CSH-SFU-6 | p95 join <5s documented |

**Out of mesh hardening PR scope** — track as separate GitHub epic with sub-issues per step.

---

## 9) Phase 6 — Observability and runbook

| Step | Action | Spec IDs | Done when |
| ---- | ------ | -------- | --------- |
| 6.1 | Add `hypha.callDebug` localStorage gate for media snapshots | CSH-QA-2 | Support can enable without rebuild |
| 6.2 | Extend [voice-video-call-phase-0-runbook.md](./voice-video-call-phase-0-runbook.md) with stall/recover and multi-tab sections | CSH-QA-* | Runbook PR merged |
| 6.3 | Document mesh load targets (tiers S/M/L) in runbook | CSH-SCALE-* | QA uses tiers for test planning |

---

## 10) Acceptance criteria — epic complete (mesh v1)

These supplement [voice-video-call-implementation-plan.md §3](./voice-video-call-implementation-plan.md).

### Functional

- [x] **CSH-CHROME-1–5** enforced; PR #2284 merged
- [ ] Share handoff stable (CSH-SHARE-1–3)
- [ ] Join modal shipped (CSH-DISCOVER-1) OR explicitly deferred with product sign-off
- [ ] Scale warning visible above 12 devices (CSH-SCALE-2)
- [ ] Recording compositor refresh (CSH-RECORD-1)

### Quality

- [ ] Manual QA script (spec §9.2) all rows pass on staging
- [ ] Tier **S** (≤8 devices): p95 join <8s on broadband (dev telemetry)
- [ ] Tier **M** (8–15): no critical crashes in 30-min call test
- [ ] Product copy does not claim community-scale until Phase 5 ships

### Not required for mesh v1 complete

- LiveKit / SFU (Phase 5)
- Hard join cap at 20 devices (unless product requests CSH-SCALE-3 enforcement)

---

## 11) PR breakdown (superseded)

**Use [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md)** for the single implementation PR strategy. The table below is the original phased breakdown from PR #2285 (kept for traceability).

| PR | Branch prefix | Phase | Scope |
| -- | ------------- | ----- | ----- |
| 1 | `fix/call-banner-regression` | P0 | **Merged — PR #2284** |
| 2–8 | *(merged into one impl PR)* | P1–P4, P6 | See consolidated plan |
| Epic | `feat/livekit-group-calls` | P5 | SFU integration (out of scope for consolidated PR) |

---

## 12) Risk register

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Mesh overload at 15+ devices | Poor UX, support load | CSH-SCALE-2 warning; honest product bounds |
| ~~PR #2284 merge delay~~ | ~~Banner regression persists in prod~~ | **Resolved** — merged to `main` |
| Mobile presenter stuck | User cannot stop share | CSH-SHARE-6 auto-stop or explicit stop affordance |
| Client recording CPU at tier M | Tab freeze during capture | CSH-RECORD-5; cap compositor participant tiles in recording layout |
| SFU infra delay | Cannot serve community calls | Phase 5 epic; do not block P0–P4 |

---

## 13) References

- [call-stability-hardening-spec.md](./call-stability-hardening-spec.md)
- [voice-video-call-implementation-spec.md](./voice-video-call-implementation-spec.md)
- [ADR 0001](../adr/0001-voice-video-recording-pipeline.md)
- PR #2284, #2273, #2275, #2276
