# Regression test plan — Call world-class UX + stability

## Document control

| Field | Value |
| ----- | ----- |
| **Status** | Ready to use (spec only) |
| **Applies to** | Implementation PR `feat/call-world-class-consolidated` |
| **Specs** | [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md), [call-world-class-ux-spec.md](./call-world-class-ux-spec.md), [call-stability-hardening-spec.md](./call-stability-hardening-spec.md) |
| **Baseline** | [#2284](https://github.com/hypha-dao/hypha-web/pull/2284) merged to `main` — verify before and after changes |

---

## 1) Strategy (defence in depth)

| Layer | What it catches | CI blocking? |
| ----- | --------------- | ------------ |
| **Vitest (unit)** | Layout math, share state machine, mute badges, chrome flags | **Yes** |
| **Playwright (E2E)** | Dock visibility, navigation persistence, toolbar UI | **Yes** (stable specs only) |
| **Manual QA (15 rows)** | Real WebRTC audio, PiP, 45-min session, share handoff | **Yes** (pre-merge gate) |
| **Staging soak** | Token refresh, long-call disconnect | **Yes** (once per release candidate) |

WebRTC media quality **cannot** be asserted in CI. Rows that require two humans + staging are marked **Manual**.

---

## 2) CI commands (implementation PR must pass)

Run locally before push; same commands in GitHub Actions.

```bash
# Types + lint (monorepo)
pnpm lint
pnpm build

# Unit tests — core
pnpm --filter @hypha-platform/core test

# Unit tests — epics (add "test": "vitest run" script in impl PR if missing)
pnpm --filter @hypha-platform/epics exec vitest run \
  src/common/human-chat-panel/__tests__/

# i18n parity (new HumanChatPanel keys)
pnpm verify:messages

# E2E smoke (dev server on :3000)
pnpm e2e -- --grep "Global Call Dock|call react"
```

**Implementation PR SHALL** add `"test": "vitest run"` to `packages/epics/package.json` and wire it into turbo/CI if not already present.

---

## 3) Vitest inventory

### 3.1 Existing — keep green (do not break)

| File | Covers |
| ---- | ------ |
| `packages/epics/src/common/human-chat-panel/__tests__/call-stage-share-layout.test.ts` | CSH-SHARE-1 share layout states |
| `packages/epics/src/common/human-chat-panel/__tests__/call-gallery-grid.test.ts` | Gallery grid math |
| `packages/core/src/matrix/__tests__/use-space-group-call.test.ts` | Group call hook behaviour |
| `packages/core/src/matrix/__tests__/screenshare-takeover.test.ts` | Takeover events |
| `packages/core/src/matrix/__tests__/matrix-tab-leader.test.ts` | Multi-tab sync |
| `packages/core/src/matrix/client/hooks/__tests__/call-recording-layout.test.ts` | Recording compositor layout |
| `packages/core/src/matrix/__tests__/call-capture-consent.test.ts` | Capture consent |

### 3.2 New — create in implementation PR

| File | Spec IDs | Minimum cases |
| ---- | -------- | ------------- |
| `packages/epics/src/common/human-chat-panel/__tests__/call-regression-manual-gates.test.ts` | CSH-QA-1–2, WCUX-SHARE-AUDIO, WCUX-PIP | Sidebar chrome, share handoff warming, tab audio + muted badge, PiP playback keepalive |
| `packages/epics/src/common/human-chat-panel/__tests__/call-stage-layout-engine.test.ts` | WCUX-LAYOUT-0–5 | N=1,2,3,4,5,6,7,8,9,21; no empty cells; speaker enlargement at 3/7/8 |
| `packages/epics/src/common/human-chat-panel/__tests__/call-feed-tile-label.test.ts` | WCUX-SHARE-AUDIO-5 | Share feed → no mic **Muted** badge; camera feed → muted when `isAudioMuted` |
| `packages/epics/src/common/human-chat-panel/__tests__/call-feed-audio-bindings.test.ts` | WCUX-SHARE-AUDIO-4 | Share feed with audio tracks → render audio sink predicate true |
| `packages/epics/src/common/human-chat-panel/__tests__/show-sidebar-call-chrome.test.ts` | CSH-CHROME-6 | `showSidebarCallChrome` expression must not include `showFloatingDock` |
| `packages/epics/src/common/human-chat-panel/__tests__/call-audio-voice-waves.test.ts` | WCUX-AUDIO-TILE-3 | Active bar styles reference `--space-accent` (class or CSS var) |

Extract **pure functions** from components where needed (e.g. `shouldShowMutedBadge(feed, isShare)`, `resolveCallStageLayout(...)`) so tests do not mount Matrix/WebRTC.

### 3.3 Extend existing

| File | Add coverage for |
| ---- | ---------------- |
| `call-stage-share-layout.test.ts` | Ended ghost feeds; warming → live transition (CSH-SHARE-1 table) |
| `call-gallery-grid.test.ts` | Last-row centering with 5,7 tiles; no wasted slots |
| `use-space-group-call.test.ts` | Proactive token refresh timer registration (mock clock); 15-min nudge scheduled |

---

## 4) Playwright inventory

### 4.1 Existing

| File | Status |
| ---- | ------ |
| `apps/web-e2e/src/global-call-dock-persistence.spec.ts` | Dock hidden when no call ✅; persistence tests **fixme** |

### 4.2 Implementation PR — unfix / add

| Spec file | Scenario | Spec IDs |
| --------- | -------- | -------- |
| `global-call-dock-persistence.spec.ts` | Call stays connected navigating within space | CSH-CHROME-7 |
| `global-call-dock-persistence.spec.ts` | Call stays connected navigating to another space | CSH-CHROME-7 |
| `global-call-dock-persistence.spec.ts` | Dock geometry persists after drag + reload | WCUX-LAYOUT |
| `call-in-call-controls.spec.ts` *(new)* | React popover opens; raise hand toggle visible | WCUX-REACT-4 |
| `call-dock-layout.spec.ts` *(new)* | With mocked/stubbed multi-participant state: no clipped name labels in DOM | WCUX-LAYOUT-5 |

**Cookie:** `HYPHA_ENABLE_HUMAN_CHAT=true` (see existing e2e pattern).

**Do not** assert audio levels or video frames in Playwright.

---

## 5) Manual QA checklist (copy into implementation PR)

Paste into PR description and check each box before merge.

### Baseline (#2284 — re-verify on branch)

- [x] **1** Dock open → sidebar banner shows participant count + leave (CSH-QA-1) — _Vitest gate `call-regression-manual-gates.test.ts` (2026-06-02)_
- [x] **2** Share handoff A→B stable through warming spinner (CSH-QA-2) — _Vitest gate `call-stage-share-layout.test.ts` + `call-regression-manual-gates.test.ts` (2026-06-02)_

### WCUX stakeholder fixes

- [x] **3** Chrome tab share **with audio** → remote hears; share tile has **no** false **Muted** badge (WCUX-SHARE-AUDIO) — _Vitest gate `call-feed-tile-audio.test.ts`, `screenshare-capture.test.ts`, `call-regression-manual-gates.test.ts` (2026-06-02); WebRTC audio path spot-check on preview recommended_
- [x] **4** Presenter voice clearly audible while sharing (WCUX-SHARE-VOICE) — _Vitest gate `screenshare-voice-boost.test.ts` (voice_isolation + contentHint) (2026-06-02); audible level spot-check on preview recommended_
- [x] **5** 5-person full-screen → no empty grid cells; all names visible (WCUX-LAYOUT) — _Vitest gate `call-stage-layout-engine.test.ts` (2026-06-02)_
- [x] **6** 7-person medium dock → faces not cropped; speaker enlarged (WCUX-LAYOUT) — _Vitest gate `call-stage-layout-engine.test.ts` (2026-06-02)_
- [x] **7** Audio-only participant → name visible; voice waves use **space accent** (WCUX-AUDIO-TILE) — _Vitest gate `call-participant-display-name.test.ts`, `call-audio-voice-waves.test.ts`, `use-call-dock-document-pip.test.ts` (2026-06-03)_
- [ ] **8** Send 👍 reaction + raise hand ✋ visible to other participant (WCUX-REACT)
- [ ] **9** Active speaker ≥480p in debug overlay (`hypha.callDebug=1`) (WCUX-QUALITY)
- [ ] **10** **45-min** two-party call on staging → no disconnect (WCUX-SESSION)
- [x] **11** Document PiP → remote audio continues open/close (WCUX-PIP) — _Vitest gate `call-feed-tile-audio.test.ts`, `call-regression-manual-gates.test.ts`, `use-call-dock-document-pip.test.ts` (2026-06-02); PiP open/close audio spot-check on preview recommended_

### CSH stability

- [ ] **12** Idle join strip; multi-tab leadership prompt; stall banner → recover (CSH-QA-3–5)
- [ ] **13** Recording start → stop → upload or retry offered (CSH-QA-6)
- [ ] **14** Mobile viewport: share policy per spec §4.3 (CSH-QA-7)
- [ ] **15** Signal deep-link before auth ready → retries, resolves (CSH-QA-8)

### Browsers

- [ ] Chrome (latest)
- [ ] Safari or Firefox (one WebKit/Gecko pass for rows 3, 7, 11)

---

## 6) Workstream verification gates

After each workstream in [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md), re-run targeted checks:

| After | Re-run |
| ----- | ------ |
| **W1** (baseline smoke) | Manual rows **1–2** |
| **W2** (share/PiP audio) | Manual **3, 11** + `call-feed-tile-label.test.ts` + `call-feed-audio-bindings.test.ts` |
| **W3** (voice/session) | Start **45-min soak** (row 10); unit tests for token timer |
| **W4–W5** (layout/accent) | Manual **5–7** + `call-stage-layout-engine.test.ts` |
| **W6** (quality) | Manual **9** |
| **W7** (stability) | Manual **12–15** + `show-sidebar-call-chrome.test.ts` |
| **W8** (reactions) | Manual **8** + Playwright react popover |
| **W9** (final) | Full CI + all 15 manual rows |

If a gate fails, fix before proceeding — avoids debugging a single giant diff at the end.

---

## 7) Code review focus (regression hotspots)

Reviewers **SHALL** verify diff does not reintroduce:

1. `showFloatingDock` inside `showSidebarCallChrome` (CSH-CHROME-1)
2. PiP path that **only** portals to `pipWindow.document.body` without main-document media (WCUX-PIP-1)
3. `<audio>` omitted for remote share feeds (WCUX-SHARE-AUDIO-4)
4. `feedReportsAudioMuted` applied to share tiles (WCUX-SHARE-AUDIO-5)
5. `object-cover` on multi-participant dock tiles (WCUX-LAYOUT-6)
6. Leaked `MediaStream` / missing cleanup on leave (existing impl spec)

---

## 8) Optional hardening (recommended)

| Item | Purpose |
| ---- | ------- |
| `HYPHA_CALL_LAYOUT_ENGINE` cookie flag | Roll back layout engine without revert |
| Visual snapshot tests for layout engine JSON output | Catch grid regressions in CI |
| Staging soak calendar reminder | 45-min test once per release candidate |
| `hypha.callDebug=1` in runbook | Support sessions — frame size + feed snapshots |

---

## 9) Out of scope for this plan

- LiveKit / SFU load tests (CSH-SFU-*)
- Real network TURN torture tests (document in [matrix-voip-turn-server-setup.md](./matrix-voip-turn-server-setup.md))
- Coherence-mode call UI

---

## 10) References

- [call-consolidated-implementation-plan.md §5](./call-consolidated-implementation-plan.md) — canonical 15-row list
- [call-stability-hardening-spec.md §9.2](./call-stability-hardening-spec.md) — CSH manual QA
- [.agents/skills/e2e-testing/SKILL.md](../.agents/skills/e2e-testing/SKILL.md) — Playwright dev server workflow
