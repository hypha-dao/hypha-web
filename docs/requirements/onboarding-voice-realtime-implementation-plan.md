# Implementation plan — Onboarding Voice Realtime (Phase 2)

## Document control

| Field | Value |
| --- | --- |
| **Status** | Ready to execute (phased) |
| **Spec** | [onboarding-voice-realtime-spec.md](./onboarding-voice-realtime-spec.md) |
| **Base branch** | `feat/network-map-p1` — [PR #2300](https://github.com/hypha-dao/hypha-web/pull/2300) |
| **V1 baseline** | Web Speech voice discovery (shipped on branch): `use-onboarding-voice-interview.ts`, `OnboardingVoiceInterviewBar`, `discoveryMode` toggle |
| **Chat architecture** | **Unchanged** — `/api/chat`, `stream-chat.ts`, OpenRouter |

---

## 1) Guiding principles

1. **Voice-only addition** — Realtime replaces the voice **transport loop** (STT → chat → TTS), not the chat stack.
2. **Shared tools** — Onboarding tool executors live in one factory; chat and Realtime both import it.
3. **Vertical slices** — Each phase is demoable behind a feature flag.
4. **Fallback always works** — Web Speech V1 remains when Realtime is off or fails.
5. **Same governance rules** — Transparency, wallet handoff, and write-integrity prompts are not relaxed for voice.

---

## 2) Prerequisites (before Phase 1)

| Item | Owner | Done when |
| --- | --- | --- |
| OpenAI project + `OPENAI_API_KEY` in staging | Ops | Key in Vercel env (server-only) |
| Product sign-off on open questions (spec §14) | Product | Voice persona + PR split decided |
| Staging budget alert for Realtime usage | Ops | Dashboard or manual cap documented |

---

## 3) Step-by-step implementation plan

### Phase 0 — Environment, flag, and CSP

| Step | Action | Files / notes | Done when |
| --- | --- | --- | --- |
| 0.1 | Add feature flag `NEXT_PUBLIC_ENABLE_ONBOARDING_VOICE_REALTIME` (default `false`) | `packages/feature-flags/src/client.ts`, `index.ts` | Flag readable client + server |
| 0.2 | Document env vars in `apps/web/.env.template` | `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, flag | Template updated |
| 0.3 | CSP staging check — add OpenAI Realtime `connect-src` / `wss://` hosts | `apps/web/src/middleware.ts` | Staging WebRTC connects |
| 0.4 | Add spec cross-link in PR #2300 description or follow-up ticket | GitHub | Reviewers see Phase 2 scope |

**Acceptance:** Flag off → app behaves exactly as today (Web Speech V1).

---

### Phase 1 — Server session endpoint (no client audio yet)

| Step | Action | Files | Done when |
| --- | --- | --- | --- |
| 1.1 | Add Zod schema for session request | `packages/chat-server/src/voice-realtime/request-schema.ts` | Validates `conversationContext`, `locale` |
| 1.2 | Implement `createRealtimeVoiceSession()` | `packages/chat-server/src/voice-realtime/session.ts` | Returns session credentials; throws if key missing |
| 1.3 | Extract `buildOnboardingRealtimeInstructions()` from existing prompts | `voice-realtime/system-instructions.ts`, imports from `system-prompt.ts` | Instructions match voice guidelines |
| 1.4 | Add `POST /api/voice/realtime/session` | `apps/web/src/app/api/voice/realtime/session/route.ts` | Privy auth + flag gate + 503 without key |
| 1.5 | Export new symbols from `@hypha-platform/chat-server` | `packages/chat-server/src/index.ts` | Web route imports cleanly |
| 1.6 | Unit test: schema + instructions builder | `packages/chat-server/src/voice-realtime/__tests__/` | CI green |

**Acceptance:** Authenticated POST returns 200 + session payload in staging with flag ON and valid key; 404/503 when flag OFF or key missing.

---

### Phase 2 — Shared onboarding tool factory

| Step | Action | Files | Done when |
| --- | --- | --- | --- |
| 2.1 | Extract `createOnboardingToolExecutors(config)` from `tools/index.ts` | `packages/chat-server/src/tools/onboarding-tool-set.ts` | No behavior change to chat |
| 2.2 | Refactor `createChatTools()` to use factory for onboarding subset | `tools/index.ts` | Existing chat e2e/manual onboarding unchanged |
| 2.3 | Add `createOnboardingRealtimeTools()` wrapping same executors for Realtime format | `voice-realtime/onboarding-tools.ts` | Tool names match chat tools |
| 2.4 | Contract test: sample `onboarding_guidance` output shape | `__tests__/onboarding-tool-set.test.ts` | Card payload keys stable |

**Acceptance:** `pnpm --filter @hypha-platform/chat-server check-types` passes; onboarding chat flow manual smoke test unchanged.

---

### Phase 3 — Client Realtime hook + UI wiring

| Step | Action | Files | Done when |
| --- | --- | --- | --- |
| 3.1 | Add dependencies (`@openai/agents`, `openai`) to chat-server; browser transport dep to epics or web as needed | `package.json` files | `pnpm install` clean |
| 3.2 | Implement `useOnboardingVoiceRealtime` | `packages/epics/src/common/use-onboarding-voice-realtime.ts` | Connects WebRTC; exposes `phase`, errors |
| 3.3 | Branch hook in `ai-left-panel.tsx` | Realtime when flag + `voice_interview`; else V1 hook | Toggle still works |
| 3.4 | Same branch in `onboarding-ai-full-page.tsx` | Mirror left panel | Full-page onboarding voice works |
| 3.5 | Wire tool UI events to existing card renderers | Reuse tool part handlers from chat messages | Activation/transparency cards appear in voice mode |
| 3.6 | Optional: connection indicator on `OnboardingVoiceInterviewBar` | Subtle "Live" badge when Realtime connected | UX polish |

**Acceptance:** Staging with flag ON — user speaks, hears Realtime response, sees UI cards when tools fire.

---

### Phase 4 — Transcript bridge and mode switching

| Step | Action | Files | Done when |
| --- | --- | --- | --- |
| 4.1 | Implement `transcript-bridge.ts` (server helpers + client mapper) | `voice-realtime/transcript-bridge.ts`, epics hook | Turn → `UIMessage` parts |
| 4.2 | On each completed turn, append to `useChat` via `setMessages` or controlled append API | `ai-left-panel.tsx` | Message list shows voice turns |
| 4.3 | voice → chat: stop session, flush transcript | `handleDiscoveryModeChange` | No orphaned mic/WebRTC |
| 4.4 | chat → voice: inject last N messages into session instructions | Session POST body | Assistant continues contextually |
| 4.5 | Persist bridged messages in onboarding localStorage where applicable | `ai-onboarding-context.ts` | Reload preserves history |

**Acceptance:** Switch modes mid-onboarding; chat history includes voice turns; assistant does not repeat answered questions.

---

### Phase 5 — Fallback, errors, i18n, hardening

| Step | Action | Files | Done when |
| --- | --- | --- | --- |
| 5.1 | Fallback to V1 Web Speech on Realtime failure | Hook selection + retry once | User never stuck without voice |
| 5.2 | Error matrix: permission, network, session expired, key missing | Reuse `VoiceInterviewErrorCode` + new codes | Clear copy + recovery |
| 5.3 | i18n keys: fallback banner, Realtime connecting, session error | `packages/i18n/src/messages/*.json` | `pnpm verify:messages` passes |
| 5.4 | Session timeout (30 min idle) + cleanup on panel close | Server + client | No zombie sessions |
| 5.5 | Dev-only telemetry logs (mirror group call pattern) | `[hypha.voice_realtime]` prefix | Staging join latency visible |
| 5.6 | Security review skill on session route + CSP | `.agents/skills/security-review` | No key leak; auth enforced |

**Acceptance:** Full error matrix manual QA; axe pass on voice bar; flag OFF identical to pre-Phase-2.

---

## 4) Suggested PR slicing on #2300

Option A — **single follow-up commit series on #2300** (if PR not yet merged):

| Slice | Phases | Review focus |
| --- | --- | --- |
| PR slice 1 | Phase 0 + 1 | Flag, route, no UI change |
| PR slice 2 | Phase 2 | Refactor only; chat regression test |
| PR slice 3 | Phase 3 + 4 | Feature complete behind flag |
| PR slice 4 | Phase 5 | Polish + i18n |

Option B — **child PR** `feat/onboarding-voice-realtime` from `feat/network-map-p1` after map review (recommended if #2300 scope is already large).

---

## 5) Test plan

### Automated

```bash
pnpm --filter @hypha-platform/chat-server check-types
pnpm --filter @hypha-platform/chat-server exec vitest run src/voice-realtime
pnpm --filter @hypha-platform/chat-server exec vitest run src/tools/__tests__/onboarding-tool-set.test.ts
pnpm --filter @hypha-platform/epics check-types
pnpm verify:messages
pnpm lint
```

### Manual (staging, flag ON)

1. Open onboarding → switch to **Voice discovery**
2. Complete journey card via voice + on-screen card
3. Barge-in while assistant speaks — assistant stops and listens
4. Switch to **Chat** — transcript visible; send text message — context preserved
5. Switch back to **Voice discovery** — Realtime resumes with memory
6. Complete flow through visual assets → wallet handoff (dry run or sandbox space)
7. Toggle flag OFF — confirm Web Speech V1 works
8. Revoke mic permission — error copy + chat fallback path

### Manual (transparency / existing space — if testing from left panel post-create)

1. Ask to make space private — assistant calls `get_space_by_slug`, no false update claim
2. If change needed — `create_space_setup_proposal` + UI navigation offer

---

## 6) File checklist (new / modified)

### New

| Path | Purpose |
| --- | --- |
| `docs/requirements/onboarding-voice-realtime-spec.md` | This spec |
| `docs/requirements/onboarding-voice-realtime-implementation-plan.md` | This plan |
| `packages/chat-server/src/voice-realtime/session.ts` | Session factory |
| `packages/chat-server/src/voice-realtime/request-schema.ts` | Request validation |
| `packages/chat-server/src/voice-realtime/system-instructions.ts` | Realtime prompts |
| `packages/chat-server/src/voice-realtime/onboarding-tools.ts` | Realtime tool adapter |
| `packages/chat-server/src/voice-realtime/transcript-bridge.ts` | History sync |
| `packages/chat-server/src/tools/onboarding-tool-set.ts` | Shared executors |
| `apps/web/src/app/api/voice/realtime/session/route.ts` | HTTP entry |
| `packages/epics/src/common/use-onboarding-voice-realtime.ts` | Client hook |

### Modified

| Path | Change |
| --- | --- |
| `packages/chat-server/src/tools/index.ts` | Use onboarding tool factory |
| `packages/chat-server/src/index.ts` | Export voice-realtime |
| `packages/feature-flags/src/client.ts` | New flag |
| `packages/epics/src/common/ai-left-panel.tsx` | Hook branch + transcript sync |
| `apps/web/src/app/[lang]/onboarding/_components/onboarding-ai-full-page.tsx` | Same |
| `apps/web/src/middleware.ts` | CSP for OpenAI Realtime |
| `apps/web/.env.template` | New env vars |
| `packages/i18n/src/messages/*.json` | New strings |

---

## 7) Rollout

| Stage | Flag | Audience |
| --- | --- | --- |
| Dev | `NEXT_PUBLIC_ENABLE_ONBOARDING_VOICE_REALTIME=true` | Engineers |
| Staging | ON for internal testers | QA + product |
| Production | OFF default | Enable per environment after Phase 5 sign-off |

Rollback: set flag `false` — instant return to Web Speech V1 with no deploy revert required.

---

## 8) Definition of done (Phase 2 complete)

- [ ] All Phase 0–5 acceptance criteria met
- [ ] Spec open questions (§14) resolved or documented as deferred
- [ ] PR reviewed with `security-review` on session route
- [ ] No regression in chat-mode onboarding (flag OFF CI + manual)
- [ ] Implementation plan status updated to **Implemented** with commit SHAs
