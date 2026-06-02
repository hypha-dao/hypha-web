# Consolidated implementation plan — Call world-class UX + stability

## Document control

| Field | Value |
| ----- | ----- |
| **Status** | Ready to execute — **single implementation PR** |
| **Specs** | [call-world-class-ux-spec.md](./call-world-class-ux-spec.md) (`WCUX-*`), [call-stability-hardening-spec.md](./call-stability-hardening-spec.md) (`CSH-*`) |
| **Parent** | [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md) |
| **Spec PR** | [#2297](https://github.com/hypha-dao/hypha-web/pull/2297) (includes content from [#2285](https://github.com/hypha-dao/hypha-web/pull/2285)) |
| **Implementation PR** | `feat/call-world-class-consolidated` → `main` (one PR) |

---

## 1) Objective

Deliver **all Human panel call fixes** from stakeholder review (June 2026) **and** stability hardening (May 2026) in **one implementation PR**, so audio, layout, reliability, recording, and reactions ship together without cross-PR regression risk.

**In scope for the single PR:** all `WCUX-*` requirements + `CSH-*` requirements **except** `CSH-SFU-*` (LiveKit epic remains separate).

**Prerequisite:** Merge [#2284](https://github.com/hypha-dao/hypha-web/pull/2284) (`fix/call-banner-regression`) to `main` first, **or** cherry-pick its commits onto the consolidated branch as the opening commits.

---

## 2) Requirement reconciliation (CSH ↔ WCUX)

Where specs overlap, apply this precedence in the consolidated PR:

| Topic | CSH | WCUX | **Consolidated decision** |
| ----- | --- | ---- | ------------------------- |
| Share layout handoff | CSH-SHARE-1–3 | — | Keep CSH; add WCUX-SHARE-AUDIO for tab audio |
| Share audio playback | — | WCUX-SHARE-AUDIO-* | **Add** remote `<audio>` on share feeds |
| Presenter voice level | — | WCUX-SHARE-VOICE-* | **Add** auto voice_isolation + AGC while sharing |
| Wake lock | CSH-MESH-7 (hidden/PiP only) | WCUX-SESSION-4 (full call) | **WCUX wins:** wake lock for **entire active call**; release on leave |
| Silent AudioContext keepalive | CSH-MESH-7 | WCUX-SESSION-4 | Unchanged: only when `document.hidden \|\| documentPipOpen` |
| Token refresh | CSH-MESH-9 (reactive) | WCUX-SESSION-1–3 (proactive) | **Both:** proactive schedule + existing in-call `setAccessToken` |
| PiP portal | — | WCUX-PIP-1–2 | **Add** main-document media mount (fix regression) |
| Layout / gallery | CSH-SCALE-1 | WCUX-LAYOUT-* | **WCUX layout engine** replaces ad-hoc grid; keep scale warning (CSH-SCALE-2) |
| Active speaker UI | CSH-SFU-3 (SFU only) | WCUX-LAYOUT-3–4 | Implement speaker enlargement in **mesh** layout engine now |

---

## 3) Single PR structure

**Branch:** `feat/call-world-class-consolidated`  
**Base:** `main` (with #2284 merged)

### 3.1 Workstreams (implement in this order)

| # | Workstream | Spec IDs | Est. |
| - | ---------- | -------- | ---- |
| **W1** | Hotfix baseline (#2284 if not on main) | CSH-CHROME-*, CSH-SHARE-1–3 | — |
| **W2** | Share audio + PiP audio | WCUX-SHARE-AUDIO-*, WCUX-PIP-* | 2–3 d |
| **W3** | Presenter voice + session stability | WCUX-SHARE-VOICE-*, WCUX-SESSION-* | 2 d |
| **W4** | Layout engine (full-screen + dock) | WCUX-LAYOUT-* | 3–4 d |
| **W5** | Audio-only tile + accent | WCUX-AUDIO-TILE-* | 1 d |
| **W6** | Video quality | WCUX-QUALITY-* | 2 d |
| **W7** | Stability: chrome, discoverability, mesh, recording | CSH-CHROME-6, CSH-DISCOVER-*, CSH-MESH-*, CSH-RECORD-*, CSH-SCALE-2 | 3–4 d |
| **W8** | Reactions + raise hand | WCUX-REACT-* | 3 d |
| **W9** | Tests + i18n + runbook notes | WCUX-QA-*, CSH-QA-* | 1–2 d |

**Total estimate:** ~18–21 dev days (one team, one PR).

### 3.2 Primary files (expected touch list)

```
packages/core/src/matrix/client/hooks/use-space-group-call.ts
packages/core/src/matrix/client/hooks/call-recording.ts
packages/core/src/matrix/client/providers/matrix-provider.tsx
packages/core/src/matrix/client/hooks/space-group-call-telemetry.ts
packages/epics/src/common/global-call-dock-overlay.tsx
packages/epics/src/common/global-call-dock-context.tsx
packages/epics/src/common/human-right-panel.tsx
packages/epics/src/common/use-call-dock-document-pip.ts
packages/epics/src/common/use-call-document-keepalive.ts
packages/epics/src/common/human-chat-panel/human-chat-panel-call-stage.tsx
packages/epics/src/common/human-chat-panel/human-chat-panel-in-call-controls.tsx
packages/epics/src/common/human-chat-panel/call-audio-voice-waves.tsx
packages/epics/src/common/human-chat-panel/call-stage-share-layout.ts
packages/epics/src/common/human-chat-panel/call-stage-layout-engine.ts   (new)
packages/epics/src/common/human-chat-panel/use-call-reactions.ts         (new)
packages/epics/src/common/human-chat-panel/__tests__/*.test.ts
packages/i18n/src/messages/*.json
docs/requirements/voice-video-call-phase-0-runbook.md                    (CSH-QA runbook)
```

---

## 4) Workstream detail

### W1 — Hotfix baseline (PR #2284)

| Step | Action | IDs |
| ---- | ------ | --- |
| 1.1 | Ensure `showSidebarCallChrome` / `showSidebarCallVideo` split | CSH-CHROME-1–2 |
| 1.2 | Dock resume snapshot fields | CSH-CHROME-7 |
| 1.3 | `call-stage-share-layout.ts` + tests | CSH-SHARE-1–3 |
| 1.4 | Feed batching after screenshare takeover | CSH-SHARE-3 |

### W2 — Share audio + PiP audio

| Step | Action | IDs |
| ---- | ------ | --- |
| 2.1 | Remote `<audio>` for share feeds with audio tracks | WCUX-SHARE-AUDIO-4 |
| 2.2 | Suppress false **Muted** badge on share tiles | WCUX-SHARE-AUDIO-5–6 |
| 2.3 | `getDisplayMedia` with `audio: true` | WCUX-SHARE-AUDIO-1–2 |
| 2.4 | PiP portal: media stays on main `document.body` | WCUX-PIP-1 |
| 2.5 | `resumeCallPlayback()` on PiP toggle | WCUX-PIP-2 |
| 2.6 | Unit test: share muted-badge logic | WCUX-QA |

### W3 — Presenter voice + session stability

| Step | Action | IDs |
| ---- | ------ | --- |
| 3.1 | Auto `voice_isolation` + AGC while screensharing | WCUX-SHARE-VOICE-1–2 |
| 3.2 | `contentHint` speech vs music | WCUX-SHARE-VOICE-3 |
| 3.3 | Proactive Matrix token refresh (25 min or TTL−10 min) | WCUX-SESSION-1–2 |
| 3.4 | Reconnect banner on refresh failure | WCUX-SESSION-3 |
| 3.5 | Wake lock for full call duration | WCUX-SESSION-4 |
| 3.6 | 15-min `placeOutgoingCalls` nudge | WCUX-SESSION-5 |
| 3.7 | Session end telemetry | WCUX-SESSION-6 |

### W4 — Layout engine

| Step | Action | IDs |
| ---- | ------ | --- |
| 4.1 | New `call-stage-layout-engine.ts` (thresholds §3.2 WCUX spec) | WCUX-LAYOUT-0–5 |
| 4.2 | Wire full-screen + dock tiers V-S/M/L/PiP | WCUX-LAYOUT-6–7 |
| 4.3 | `panelVideoFit='contain'` for multi-participant dock | WCUX-LAYOUT-1, WCUX-LAYOUT-6 |
| 4.4 | Fix name label clipping | WCUX-LAYOUT-5 |
| 4.5 | Vitest: N=1..9, 21+ | WCUX-QA |

### W5 — Audio-only tile

| Step | Action | IDs |
| ---- | ------ | --- |
| 5.1 | Name fallback after 4 s profile timeout | WCUX-AUDIO-TILE-1–2 |
| 5.2 | Voice waves use `--space-accent` | WCUX-AUDIO-TILE-3–5 |

### W6 — Video quality

| Step | Action | IDs |
| ---- | ------ | --- |
| 6.1 | 720p ideal capture constraints | WCUX-QUALITY-1 |
| 6.2 | Simulcast layer selection audit | WCUX-QUALITY-2 |
| 6.3 | Thumbnail downscale when N≥5 | WCUX-QUALITY-4 |
| 6.4 | Debug frame size logging | WCUX-QUALITY-5 |

### W7 — Stability hardening (from PR #2285)

| Step | Action | IDs |
| ---- | ------ | --- |
| 7.1 | Chrome guard unit test for `showSidebarCallChrome` | CSH-CHROME-6 |
| 7.2 | Join invitation modal | CSH-DISCOVER-1 |
| 7.3 | Signal deep-link auth retry | CSH-DISCOVER-2–3 |
| 7.4 | Scale warning banner (>12 devices) | CSH-SCALE-2 |
| 7.5 | Mobile share policy (option A recommended) | CSH-SHARE-5–6 |
| 7.6 | Multi-tab leadership prompt | CSH-MESH-5–6 |
| 7.7 | Stall banner copy split | CSH-MESH-3–4 |
| 7.8 | Optional 20s pairwise retry (env flag) | CSH-MESH-1 |
| 7.9 | Recording compositor re-bind + upload persistence | CSH-RECORD-1–3 |
| 7.10 | `hypha.callDebug` localStorage gate | CSH-QA-2 |

### W8 — Reactions + raise hand

| Step | Action | IDs |
| ---- | ------ | --- |
| 8.1 | Call-session anchor + `use-call-reactions.ts` | WCUX-REACT-1–3 |
| 8.2 | React popover (Emoji Mart reuse) | WCUX-REACT-4–6 |
| 8.3 | Floating emoji on tiles | WCUX-REACT-5 |
| 8.4 | i18n all locales | WCUX-REACT-7 |
| 8.5 | Playwright toolbar smoke | WCUX-QA |

---

## 5) Combined manual QA checklist

Run **once** before merge. All rows must pass.

| # | Scenario | Spec |
| - | -------- | ---- |
| 1 | Dock open: sidebar banner shows count + leave | CSH-QA-1 |
| 2 | Share handoff A→B stable through warming | CSH-QA-2 |
| 3 | Tab share with audio — remote hears; no false Muted | WCUX-SHARE-AUDIO |
| 4 | Presenter voice audible while sharing | WCUX-SHARE-VOICE |
| 5 | 5-person full-screen — no empty cells, names visible | WCUX-LAYOUT |
| 6 | 7-person medium dock — faces not cropped | WCUX-LAYOUT |
| 7 | Audio-only tile — name + space accent waves | WCUX-AUDIO-TILE |
| 8 | Send reaction + raise hand | WCUX-REACT |
| 9 | Video quality ≥480p active speaker (debug mode) | WCUX-QUALITY |
| 10 | 45-min call — no disconnect | WCUX-SESSION |
| 11 | Document PiP — audio continues | WCUX-PIP |
| 12 | Join idle / multi-tab / stall recover | CSH-QA-3–5 |
| 13 | Recording capture → upload → retry | CSH-QA-6 |
| 14 | Mobile share policy | CSH-QA-7 |
| 15 | Signal deep-link before auth | CSH-QA-8 |

---

## 6) Out of scope (separate epic)

- **CSH-SFU-1–6** — LiveKit / community calls
- Coherence-mode call UI
- Hard join cap at 20 devices (unless product requests CSH-SCALE-3 enforcement)

---

## 7) PR template (implementation)

```markdown
## Summary
Consolidated Human panel call fixes: share/PiP audio, layout engine,
session stability, stability hardening (CSH), reactions, video quality.

## Spec traceability
- WCUX-*: call-world-class-ux-spec.md
- CSH-*: call-stability-hardening-spec.md
- Plan: call-consolidated-implementation-plan.md

## Test plan
- [ ] Manual QA checklist §5 (15 rows)
- [ ] Vitest: layout engine, share layout, chrome guard, feed labels
- [ ] Playwright: reaction popover, raise hand toggle
- [ ] 45-min soak (staging, two browsers)
```

---

## 8) References

- PR [#2285](https://github.com/hypha-dao/hypha-web/pull/2285) — stability spec (absorbed)
- PR [#2297](https://github.com/hypha-dao/hypha-web/pull/2297) — consolidated spec PR
- PR [#2284](https://github.com/hypha-dao/hypha-web/pull/2284) — hotfix prerequisite
- [call-world-class-ux-implementation-plan.md](./call-world-class-ux-implementation-plan.md) — original WCUX phase breakdown (reference)
