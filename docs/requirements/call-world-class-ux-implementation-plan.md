# Implementation plan — Call world-class UX

## Document control

| Field | Value |
| ----- | ----- |
| **Status** | Ready to execute (phased) |
| **Spec** | [call-world-class-ux-spec.md](./call-world-class-ux-spec.md) |
| **Parent** | [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md) |

---

## 1) Guiding principles

1. **Fix audio regressions first** — Share audio playback and PiP audio are P0; ship before layout polish.
2. **Pure layout engine** — Participant threshold logic lives in tested pure functions, not scattered JSX.
3. **Reuse chat emoji stack** — Call reactions use existing Emoji Mart surface and Matrix `m.reaction` patterns.
4. **Vertical slices** — Each phase is demoable with manual QA rows from spec §11.2.
5. **No SFU scope creep** — Mesh limits from call-stability spec still apply; layout optimizes within mesh tier S (≤8 devices high quality).

---

## 2) Phase overview

| Phase | Name | Stakeholder items | Est. |
| ----- | ---- | ----------------- | ---- |
| **P0** | Share & PiP audio hotfix | #1 (partial), #9 | 2–3 days |
| **P1** | Presenter voice + session stability | #2, #8 | 2–3 days |
| **P2** | Layout engine — full-screen | #3 | 3–4 days |
| **P3** | Layout engine — dock sizes | #4 | 2–3 days |
| **P4** | Audio-only tile + accent | #5 | 1 day |
| **P5** | Video quality | #7 | 2 days |
| **P6** | Reactions & raise hand | #6 | 3–4 days |

Phases P0–P1 **MAY** ship as one PR if review bandwidth is limited; P2–P3 **SHOULD** be separate for visual diff review.

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

**Done when:** Manual QA rows **1** and **9** pass on Chrome + Safari (best-effort).

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

**Done when:** Manual QA rows **2** and **8** pass (45-min soak scheduled).

---

## 5) Phase P2 — Full-screen layout engine

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 2.1 | Create `call-stage-layout-engine.ts` with threshold table §3.2 | WCUX-LAYOUT-0–5 | new module |
| 2.2 | Vitest coverage for N=1..9, 21+ | WCUX-QA | `call-stage-layout-engine.test.ts` |
| 2.3 | Wire `HumanChatPanelCallStage` fullView branch to engine output | WCUX-LAYOUT-3–4 | `human-chat-panel-call-stage.tsx` |
| 2.4 | Fix name label clipping (`min-height`, no overflow hidden on label) | WCUX-LAYOUT-5 | same |
| 2.5 | Active speaker enlargement for N=3,7,8 | WCUX-LAYOUT-3 | same |

**Done when:** Manual QA row **3** pass; screenshot parity with Zoom gallery reference for 5 and 7 participants.

---

## 6) Phase P3 — Dock size responsive layouts

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 3.1 | Pass `viewportTier` derived from `dockMode` + geometry into stage | WCUX-LAYOUT-0 | `global-call-dock-overlay.tsx` |
| 3.2 | Speaker + strip layouts for V-S/M (§3.3) | WCUX-LAYOUT-6–7 | `call-stage-layout-engine.ts`, call stage |
| 3.3 | Default `panelVideoFit='contain'` for multi-participant dock | WCUX-LAYOUT-6 | dock overlay props |
| 3.4 | Portrait dock aspect: stack speaker over strip | WCUX-LAYOUT-1 | layout engine |

**Done when:** Manual QA row **4** pass (images 4, 6, 8 scenarios reproduced and fixed).

---

## 7) Phase P4 — Audio-only tile polish

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 4.1 | Name fallback timeout in `useCallParticipantDisplayName` | WCUX-AUDIO-TILE-1–2 | `human-chat-panel-call-stage.tsx` |
| 4.2 | Replace emerald wave colours with `--space-accent` | WCUX-AUDIO-TILE-3–4 | `call-audio-voice-waves.tsx` |
| 4.3 | Verify PiP copies accent vars | WCUX-AUDIO-TILE-5 | `use-call-dock-document-pip.ts` |

**Done when:** Manual QA row **5** pass.

---

## 8) Phase P5 — Video quality

| Step | Action | Spec IDs | Files |
| ---- | ------ | -------- | ----- |
| 5.1 | Raise camera capture constraints on join | WCUX-QUALITY-1 | `use-space-group-call.ts` |
| 5.2 | SDK simulcast audit + layer selection | WCUX-QUALITY-2 | same + matrix SDK types |
| 5.3 | Thumbnail downscale when N≥5 | WCUX-QUALITY-4 | new helper in call stage |
| 5.4 | Debug overlay frame size | WCUX-QUALITY-5 | `group-call-webrtc-diagnostics.ts` |

**Done when:** Manual QA row **7** (Q1/Q2) pass in debug mode.

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

**Done when:** Manual QA rows **6–7** pass.

---

## 10) PR strategy

| PR | Branch | Contents |
| -- | ------ | -------- |
| **PR-1 (this PR)** | `spec/call-world-class-ux` | Spec + plan only |
| **PR-2** | `fix/call-share-pip-audio` | P0 |
| **PR-3** | `fix/call-voice-session` | P1 |
| **PR-4** | `feat/call-layout-engine` | P2 + P3 |
| **PR-5** | `fix/call-audio-tile-accent` | P4 |
| **PR-6** | `feat/call-video-quality` | P5 |
| **PR-7** | `feat/call-reactions-raise-hand` | P6 |

Each implementation PR **SHALL** reference `WCUX-*` IDs in description and check off manual QA rows.

---

## 11) Dependencies

- Merge [call-stability-hardening-spec.md](./call-stability-hardening-spec.md) items **CSH-SHARE-1–3** before P0 if not already on `main` (share warming layout).
- Emoji Mart assets already bundled for chat — no new dependency for P6.
- 45-min soak test requires two test accounts and stable TURN (see [matrix-voip-turn-server-setup.md](./matrix-voip-turn-server-setup.md)).

---

## 12) Success criteria (release)

- All **WCUX-QA** manual rows pass on Chrome latest + one WebKit browser.
- No P0 regressions in existing call-stability QA rows 1–2.
- Product sign-off on 5- and 7-person layout screenshots vs Zoom reference.
