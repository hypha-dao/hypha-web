# Implementation plan — Call world-class UX (phase reference)

## Document control

| Field | Value |
| ----- | ----- |
| **Status** | Reference — **do not use for PR breakdown** |
| **Spec** | [call-world-class-ux-spec.md](./call-world-class-ux-spec.md) |
| **Execute via** | [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md) (**single implementation PR**) |
| **Stability spec** | [call-stability-hardening-spec.md](./call-stability-hardening-spec.md) (PR [#2285](https://github.com/hypha-dao/hypha-web/pull/2285)) |

> **Note:** Stakeholder and product agreed to address **all call issues in one implementation PR**. This document retains the original WCUX work breakdown (P0–P6) for estimation and code-review ordering inside that PR. See consolidated plan workstreams W2–W8.

---

## 1) Guiding principles

1. **Fix audio regressions first** — Share audio playback and PiP audio are P0; ship before layout polish.
2. **Pure layout engine** — Participant threshold logic lives in tested pure functions, not scattered JSX.
3. **Reuse chat emoji stack** — Call reactions use existing Emoji Mart surface and Matrix `m.reaction` patterns.
4. **Vertical slices** — Each phase leaves calling demoable with updated manual QA rows.
5. **No SFU scope creep** — Mesh limits from call-stability spec still apply; layout optimizes within mesh tier S (≤8 devices high quality).
6. **Include stability hardening** — All `CSH-*` items (except SFU) ship in the same PR per [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md).

---

## 2) Phase overview (work order inside single PR)

| Phase | Name | Stakeholder items | Consolidated WS |
| ----- | ---- | ----------------- | --------------- |
| **P0** | Share & PiP audio hotfix | #1 (partial), #9 | W2 |
| **P1** | Presenter voice + session stability | #2, #8 | W3 |
| **P2** | Layout engine — full-screen | #3 | W4 |
| **P3** | Layout engine — dock sizes | #4 | W4 |
| **P4** | Audio-only tile + accent | #5 | W5 |
| **P5** | Video quality | #7 | W6 |
| **P6** | Reactions & raise hand | #6 | W8 |
| **CSH** | Stability hardening | banner, mesh, recording, discoverability | W1, W7 |

---

## 3) Phase P0 — Share & PiP audio hotfix

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 0.1 | Add `<audio>` playback for remote `isShare` feeds when stream has audio tracks | WCUX-SHARE-AUDIO-4 | `human-chat-panel-call-stage.tsx` |
| 0.2 | Suppress mic **Muted** badge on share tiles; show presenter name + share label | WCUX-SHARE-AUDIO-5, WCUX-SHARE-AUDIO-6 | same |
| 0.3 | Audit Matrix SDK screenshare path; wrap/override to pass `audio: true` in `getDisplayMedia` | WCUX-SHARE-AUDIO-1 | `use-space-group-call.ts` or SDK fork hook |
| 0.4 | Presenter toast when share surface has no audio track | WCUX-SHARE-AUDIO-2 | `global-call-dock-overlay.tsx`, i18n |
| 0.5 | Fix PiP portal: always mount media in main `document.body`; PiP gets visual-only clone OR dual portal | WCUX-PIP-1 | `global-call-dock-overlay.tsx` |
| 0.6 | `resumeCallPlayback()` on PiP open/close | WCUX-PIP-2 | `human-chat-panel-call-stage.tsx`, hook |
| 0.7 | Unit tests for share muted-badge logic | WCUX-QA | `__tests__/call-feed-tile-label.test.ts` |

**Done when:** Manual QA rows **3** and **11** pass (consolidated checklist §5).

---

## 4) Phase P1 — Presenter voice + session stability

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 1.1 | Auto `voice_isolation` + AGC boost while `isScreensharing` | WCUX-SHARE-VOICE-1, WCUX-SHARE-VOICE-2 | `use-space-group-call.ts` |
| 1.2 | Set `contentHint` on mic vs share audio tracks | WCUX-SHARE-VOICE-3 | same |
| 1.3 | Proactive Matrix token refresh timer during active call | WCUX-SESSION-1, WCUX-SESSION-2 | `matrix-provider.tsx` |
| 1.4 | Reconnect banner on refresh failure | WCUX-SESSION-3 | `global-call-dock-overlay.tsx` |
| 1.5 | Wake lock for entire call; keepalive policy update | WCUX-SESSION-4 | `use-call-document-keepalive.ts` |
| 1.6 | 15-min pairwise nudge | WCUX-SESSION-5 | `use-space-group-call.ts` |
| 1.7 | Session end telemetry fields | WCUX-SESSION-6 | `space-group-call-telemetry.ts` |

**Done when:** Manual QA rows **4** and **10** pass.

---

## 5) Phase P2 — Full-screen layout engine

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 2.1 | Create `call-stage-layout-engine.ts` with threshold table §3.2 | WCUX-LAYOUT-0–5 | new module |
| 2.2 | Vitest coverage for N=1..9, 21+ | WCUX-QA | `call-stage-layout-engine.test.ts` |
| 2.3 | Wire `HumanChatPanelCallStage` fullView branch to engine output | WCUX-LAYOUT-3–4 | `human-chat-panel-call-stage.tsx` |
| 2.4 | Fix name label clipping (`min-height`, no overflow hidden on label) | WCUX-LAYOUT-5 | same |
| 2.5 | Active speaker enlargement for N=3,7,8 | WCUX-LAYOUT-3 | same |

**Done when:** Manual QA row **5** pass.

---

## 6) Phase P3 — Dock size responsive layouts

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 3.1 | Pass `viewportTier` derived from `dockMode` + geometry into stage | WCUX-LAYOUT-0 | `global-call-dock-overlay.tsx` |
| 3.2 | Speaker + strip layouts for V-S/M (§3.3) | WCUX-LAYOUT-6–7 | `call-stage-layout-engine.ts`, call stage |
| 3.3 | Default `panelVideoFit='contain'` for multi-participant dock | WCUX-LAYOUT-6 | dock overlay props |
| 3.4 | Portrait dock aspect: stack speaker over strip | WCUX-LAYOUT-1 | layout engine |

**Done when:** Manual QA row **6** pass.

---

## 7) Phase P4 — Audio-only tile polish

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 4.1 | Name fallback timeout in `useCallParticipantDisplayName` | WCUX-AUDIO-TILE-1–2 | `human-chat-panel-call-stage.tsx` |
| 4.2 | Replace emerald wave colours with `--space-accent` | WCUX-AUDIO-TILE-3–4 | `call-audio-voice-waves.tsx` |
| 4.3 | Verify PiP copies accent vars | WCUX-AUDIO-TILE-5 | `use-call-dock-document-pip.ts` |

**Done when:** Manual QA row **7** pass.

---

## 8) Phase P5 — Video quality

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 5.1 | Raise camera capture constraints on join | WCUX-QUALITY-1 | `use-space-group-call.ts` |
| 5.2 | SDK simulcast audit + layer selection | WCUX-QUALITY-2 | same + matrix SDK types |
| 5.3 | Thumbnail downscale when N≥5 | WCUX-QUALITY-4 | new helper in call stage |
| 5.4 | Debug overlay frame size | WCUX-QUALITY-5 | `group-call-webrtc-diagnostics.ts` |

**Done when:** Manual QA row **9** pass.

---

## 9) Phase P6 — Reactions & raise hand

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 6.1 | Define call-session anchor event on join | WCUX-REACT-1–3 | `use-space-group-call.ts` |
| 6.2 | Matrix send/receive reaction aggregation hook | WCUX-REACT-1 | `use-call-reactions.ts` (new) |
| 6.3 | Raise hand toggle + room notice events | WCUX-REACT-2 | same |
| 6.4 | `CallReactPopover` UI + toolbar button | WCUX-REACT-4–6 | `human-chat-panel-in-call-controls.tsx`, new components |
| 6.5 | Floating emoji on tiles | WCUX-REACT-5 | `human-chat-panel-call-stage.tsx` |
| 6.6 | i18n all locales | WCUX-REACT-7 | `packages/i18n/src/messages/*.json` |
| 6.7 | Playwright: popover opens, raise hand toggles | WCUX-QA | `apps/web-e2e/` |

**Done when:** Manual QA row **8** pass.

---

## 10) PR strategy (superseded)

**Use [call-consolidated-implementation-plan.md](./call-consolidated-implementation-plan.md).**

| PR | Branch | Contents |
| -- | ------ | -------- |
| **Spec** | `spec/call-world-class-ux` ([#2297](https://github.com/hypha-dao/hypha-web/pull/2297)) | All specs + plans |
| **Implementation** | `feat/call-world-class-consolidated` | **One PR** — all WCUX + CSH (except SFU) |

---

## 11) Dependencies

- Merge PR [#2284](https://github.com/hypha-dao/hypha-web/pull/2284) first or include as opening commits on consolidated branch.
- CSH-SHARE-1–3 from #2284 / stability spec are prerequisite for share audio work.
- Emoji Mart assets already bundled for chat — no new dependency for P6.
- 45-min soak test requires two test accounts and stable TURN (see [matrix-voip-turn-server-setup.md](./matrix-voip-turn-server-setup.md)).

---

## 12) Success criteria (release)

- All rows in [call-consolidated-implementation-plan.md §5](./call-consolidated-implementation-plan.md) pass.
- Product sign-off on 5- and 7-person layout screenshots vs Zoom reference.
