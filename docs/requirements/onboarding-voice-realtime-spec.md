# Technical Specification — Onboarding Voice Realtime (Phase 2)

## Document control

| Field | Value |
| --- | --- |
| Status | Draft — ready for implementation |
| Branch / PR | `feat/network-map-p1` — [PR #2300](https://github.com/hypha-dao/hypha-web/pull/2300) (V1 voice discovery ships here; Realtime is Phase 2 on same branch or follow-up PR) |
| Scope | Replace browser Web Speech transport for **Voice discovery** with OpenAI Realtime API (± Agents SDK); **Chat mode unchanged** |
| Primary surfaces | Onboarding full-page AI (`onboarding-ai-full-page.tsx`), left AI panel (`ai-left-panel.tsx`) |
| Out of scope (Phase 2) | Space-context AI chat voice, human Matrix VoIP (see [voice-video-call-implementation-plan.md](./voice-video-call-implementation-plan.md)), multilingual Realtime voices beyond locale hint |

---

## 1) Problem statement

### V1 (shipped on branch)

Voice discovery uses the **browser Web Speech API**:

| Layer | Implementation |
| --- | --- |
| STT | `SpeechRecognition` / `webkitSpeechRecognition` — `use-onboarding-voice-interview.ts` |
| LLM + tools | Transcript → `sendMessage` → `POST /api/chat` → OpenRouter + AI SDK + Hypha tools |
| TTS | `speechSynthesis` — `onboarding-voice-speech.ts` |

This works without paid APIs but has limitations:

- Quality and reliability vary by browser/OS
- No true **barge-in** (interrupt while assistant speaks)
- Noticeable latency (STT → text round-trip → TTS)
- Voice turns inherit chat formatting (markdown, bullets) unless the model strictly follows voice guidelines

### Phase 2 goal

Add a **parallel voice transport** when `conversationContext.discoveryMode === 'voice_interview'` and the Realtime feature flag is on. Chat mode continues to use `/api/chat` unchanged.

Target UX: warm human interview (10x.team quality) — low latency, natural turn-taking, barge-in, same onboarding discovery flow and UI cards.

---

## 2) Architecture decision

### ADR summary (inline — promote to `docs/adr/` if product wants formal record)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Voice engine | **OpenAI Realtime API** | Native speech-to-speech, barge-in, tool calls; official MCP guidance |
| Orchestration | **OpenAI Agents SDK (TypeScript)** for session + tool wiring | Avoid hand-rolling WebSocket event state machine; reuse Hypha tool executors |
| Chat stack | **No change** | OpenRouter + `stream-chat.ts` remains for text mode and non-onboarding AI |
| Transport to browser | **WebRTC** (preferred) via server-minted ephemeral session | Keys stay server-side; lower latency than raw browser WebSocket to OpenAI |
| Fallback | **Web Speech V1** when flag off, Realtime unavailable, or recoverable errors | Graceful degradation; no user lock-out |
| Tool reuse | **Shared executors** in `@hypha-platform/chat-server` | Single source of truth for onboarding writes, transparency policy, navigation |

### High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  AiLeftPanel / OnboardingAiFullPage                              │
│  discoveryMode: 'chat' | 'voice_interview'                       │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ chat                          │ voice + flag ON
                ▼                               ▼
        useChat → /api/chat              useOnboardingVoiceRealtime
        (unchanged)                      → /api/voice/realtime/session
                │                               │
                ▼                               ▼
        stream-chat.ts                   RealtimeVoiceSession (chat-server)
        OpenRouter + AI SDK              OpenAI Realtime + Agents SDK
                │                               │
                └───────────┬───────────────────┘
                            ▼
              createOnboardingChatTools()  (shared subset)
              onboarding_guidance, create_space_from_onboarding, …
                            │
                            ▼
              PostgreSQL, UploadThing, on-chain handoffs (unchanged)
```

### Mode matrix

| `discoveryMode` | Flag | Transport | Backend |
| --- | --- | --- | --- |
| `chat` | any | Text input + message list | `/api/chat` |
| `voice_interview` | off | Web Speech STT → text → TTS | `/api/chat` (V1) |
| `voice_interview` | on | WebRTC audio ↔ Realtime | `/api/voice/realtime/*` (V2) |

---

## 3) Integration options (evaluated)

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **OpenAI Realtime + Agents SDK** | Low latency S2S, barge-in, TS SDK, tool/MCP patterns | OpenAI-specific; separate API key/billing from OpenRouter | **Recommended** |
| Realtime only (no Agents SDK) | Smaller dependency surface | More custom session/event code | Acceptable if SDK blocks bundling |
| Pipecat (Python) | Flexible pipelines | Extra service; not in monorepo Node stack | Reject for Hypha web app |
| LiveKit Agents | Strong for group calls | Overkill for 1:1 onboarding interview | Reject (see Matrix VoIP spec) |
| Deepgram + ElevenLabs + OpenRouter | Provider choice | Higher latency; no native barge-in | Fallback tier only |

---

## 4) Server design

### 4.1 New routes (`apps/web`)

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/voice/realtime/session` | POST | Authenticate (Privy), validate onboarding context, mint Realtime session (WebRTC SDP answer or ephemeral client secret) |
| `/api/voice/realtime/events` | POST (optional) | Server-side tool execution webhook if not inline in session handler |

All routes:

- Require `Authorization: Bearer <privy_token>` (same as `/api/chat`)
- **Only allow** when `conversationContext.mode === 'onboarding_setup'` and `discoveryMode === 'voice_interview'` (Phase 2 scope)
- Respect `getEnableOnboardingWriteTools()` for write tools (mirror chat route)
- Use `maxDuration = 300` (Fluid Compute default)

### 4.2 New module (`packages/chat-server`)

Suggested files:

```
packages/chat-server/src/
  voice-realtime/
    session.ts              # createRealtimeVoiceSession()
    onboarding-tools.ts     # createOnboardingRealtimeTools() — wraps shared executors
    system-instructions.ts  # Realtime-optimized instructions (from system-prompt.ts)
    transcript-bridge.ts    # Map Realtime events → UIMessage parts for client sync
    request-schema.ts         # Zod schema for session POST body
```

Export from `@hypha-platform/chat-server`:

- `createRealtimeVoiceSession`
- `realtimeVoiceSessionRequestSchema`
- `buildOnboardingRealtimeInstructions`

### 4.3 System instructions

Reuse content from:

- `ONBOARDING_VOICE_INTERVIEW_GUIDELINES` — `system-prompt.ts`
- Onboarding setup block in `stream-chat.ts` (discovery order, visual assets, wallet handoff)
- `ONCHAIN_GOVERNANCE_WRITE_INTEGRITY`

Realtime-specific additions:

- Instruct model to **never read URLs, coordinates, or markdown** aloud
- On tool results that trigger UI cards (`onboarding_guidance`, picker payloads), emit a **short spoken bridge** ("I'll put a few options on your screen")
- Keep responses **1–2 sentences** unless user asks for detail

### 4.4 Tool surface (onboarding Realtime subset)

Minimum tool set for parity with V1 voice + chat onboarding:

| Tool | Notes |
| --- | --- |
| `onboarding_guidance` | Required each discover-phase turn |
| `get_network_ecosystem_patterns` | Ecosystem path |
| `propose_organisation_blueprint` | Ecosystem path |
| `generate_space_visual_assets` | After user confirms generation |
| `create_space_from_onboarding` | Execute phase |
| `create_ecosystem_space` | Child spaces post-root |
| `get_space_by_slug` | Post-create / transparency reads |
| `create_space_setup_proposal` | Existing-space transparency |
| `update_space_settings` | DB metadata only |
| `mcp_navigation` | Post-create handoffs |
| `geocode_space_location` | If map flag on |

**Exclude** from Realtime Phase 2 (space-context tools): documents, signals, org memory, web search — not used during onboarding setup.

Tool executors MUST call the same functions as `createChatTools()` — extract shared factory:

```typescript
// packages/chat-server/src/tools/onboarding-tool-set.ts
export function createOnboardingToolExecutors(config: OnboardingToolConfig): ToolExecutorMap;
```

Used by both `stream-chat.ts` and `voice-realtime/onboarding-tools.ts`.

### 4.5 Session lifecycle

1. Client POSTs session request with `{ conversationContext, locale, recentTranscriptSummary? }`
2. Server verifies Privy token, validates context, checks feature flag + env
3. Server creates Realtime session via OpenAI API (model: `gpt-4o-realtime-preview` or successor — pin in env `OPENAI_REALTIME_MODEL`)
4. Server returns `{ sessionId, clientSecret | sdpAnswer, expiresAt }`
5. Client connects WebRTC audio; Agents SDK handles turn detection + tool calls
6. On `response.done` / `conversation.item.created`, server/client append transcript events
7. Client pushes summarized turns into `useChat` message list for history continuity
8. On disconnect or mode switch to `chat`, session ends; partial transcript preserved

### 4.6 Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes (when flag on) | Realtime API access — **server only** |
| `OPENAI_REALTIME_MODEL` | No | Default `gpt-4o-realtime-preview-2024-12-17` or current GA id |
| `OPENAI_REALTIME_VOICE` | No | Default `marin` or product-chosen voice |
| `NEXT_PUBLIC_ENABLE_ONBOARDING_VOICE_REALTIME` | No | Build-time flag; default `false` |
| `HYPHA_ENABLE_ONBOARDING_VOICE_REALTIME` | No | Runtime cookie override (optional, mirror other flags) |

**Do not** expose `OPENAI_API_KEY` to the client. Ephemeral tokens only.

Existing `OPENROUTER_API_KEY` remains required for chat mode only.

---

## 5) Client design

### 5.1 New hook

`packages/epics/src/common/use-onboarding-voice-realtime.ts`

Responsibilities:

- Request session from `/api/voice/realtime/session`
- Manage WebRTC connection (via `@openai/agents` Realtime transport or official browser helper)
- Expose same surface as V1 where possible:

```typescript
type VoiceInterviewPhase = 'idle' | 'listening' | 'processing' | 'speaking';

type UseOnboardingVoiceRealtimeOptions = {
  enabled: boolean;
  locale: string;
  conversationContext: OnboardingConversationContext;
  onTranscriptTurn: (turn: { role: 'user' | 'assistant'; text: string }) => void;
  onToolUiEvent?: (payload: unknown) => void; // card payloads — same handlers as chat tools
  onError: (code: VoiceInterviewErrorCode) => void;
};
```

### 5.2 Integration points

| File | Change |
| --- | --- |
| `ai-left-panel.tsx` | When `isVoiceInterview && getEnableOnboardingVoiceRealtime()`, use Realtime hook; else V1 hook |
| `onboarding-ai-full-page.tsx` | Same branching |
| `onboarding-voice-interview-bar.tsx` | Optional: waveform / connection indicator for Realtime; reuse existing orb UI |
| `ai-onboarding-context.ts` | Optional: `voiceSessionId`, `voiceTransport: 'web_speech' \| 'realtime'` in context for debugging |

### 5.3 UI card parity

Structured onboarding UI (journey cards, activation, transparency matrix, entry method, location picker) is driven by **tool results** rendered in `AiPanelMessages`. Realtime must:

1. Execute the same tools server-side
2. Emit tool-result events to the client (Agents SDK `tool_call` completion)
3. Client dispatches to existing card renderers (same JSON shapes as chat tool parts)

Do **not** duplicate card components for voice.

### 5.4 Mode switching (`chat` ↔ `voice_interview`)

| Transition | Behavior |
| --- | --- |
| voice → chat | Stop Realtime session; flush pending transcript to message list; show chat bar |
| chat → voice | Start Realtime session with **conversation summary** + last N text turns injected into session instructions |
| voice (Web Speech) → voice (Realtime) | Only on flag toggle at deploy — not a runtime user toggle |

Transcript bridge: append user/assistant text from Realtime turns as `UIMessage` entries so switching to chat shows continuity.

### 5.5 Fallback behavior

Fallback to V1 Web Speech when:

- `NEXT_PUBLIC_ENABLE_ONBOARDING_VOICE_REALTIME !== true`
- Session POST returns 503 / missing `OPENAI_API_KEY`
- WebRTC connection fails after one retry
- Browser lacks WebRTC (rare)

Show non-blocking banner: "Using standard voice mode" (i18n key `onboardingVoiceRealtimeFallback`).

---

## 6) Security and compliance

| Concern | Mitigation |
| --- | --- |
| API key exposure | Server-only session minting; ephemeral client credentials |
| Auth | Privy Bearer on session route (same as chat) |
| Scope | Reject Realtime session for non-onboarding or space-context requests in Phase 2 |
| CSP | Add `connect-src` for OpenAI Realtime endpoints and TURN if used — see §7 |
| Data retention | Realtime audio not stored by Hypha in Phase 2; transcript text follows existing chat retention |
| Write integrity | Same `ONCHAIN_GOVERNANCE_WRITE_INTEGRITY` rules; tool executors shared with chat |

---

## 7) CSP and networking

Update `apps/web/src/middleware.ts` (production CSP) when enabling Realtime:

- `connect-src`: add `https://api.openai.com`, `wss://api.openai.com` (exact hosts per OpenAI Realtime WebRTC docs at implementation time)
- No new `script-src` if using bundled Agents SDK (no external script tag)

Document in `.env.template` and deployment runbook.

---

## 8) Feature flag

Add to `packages/feature-flags`:

```typescript
// client.ts
export function getEnableOnboardingVoiceRealtime(): boolean {
  return parseBoolean(process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_VOICE_REALTIME) ?? false;
}

// index.ts — flag definition for Vercel Flags SDK (optional)
```

Gate:

- Client hook selection (Realtime vs Web Speech)
- Server session route (return 404 or graceful error when disabled)

---

## 9) Dependencies

Add to `packages/chat-server` (exact versions pinned at implementation):

```json
{
  "@openai/agents": "^0.x",
  "openai": "^4.x"
}
```

Add to `packages/epics` or `apps/web` if browser Realtime client ships there:

- Agents SDK browser Realtime transport (or thin wrapper)

Run `pnpm lint` matrix-sdk check unaffected.

---

## 10) Observability

| Event | Where |
| --- | --- |
| `voice.realtime.session.created` | Server log (no PII) |
| `voice.realtime.session.failed` | Server log + client error code |
| `voice.realtime.tool.executed` | Server log (tool name only) |
| `voice.realtime.fallback` | Client log (dev) / optional analytics |

Include `x-hypha-voice-debug-id` header on session responses (mirror chat debug id pattern).

---

## 11) Acceptance criteria

### Functional

- [ ] Voice discovery with flag ON uses Realtime; user hears assistant within **<800ms** after end-of-speech (staging, median)
- [ ] User can **barge-in** while assistant speaks (interrupt + new turn)
- [ ] Onboarding flow reaches space creation with same tool/card sequence as chat mode
- [ ] Switching to chat mid-session preserves transcript in message list
- [ ] Flag OFF or missing OpenAI key → Web Speech V1 with no crash
- [ ] Transparency / on-chain write integrity rules unchanged (no false success claims)

### Non-functional

- [ ] No `OPENAI_API_KEY` in client bundle (grep + build audit)
- [ ] `pnpm check-types` passes across web, epics, chat-server
- [ ] i18n keys for new strings in en/de/es/fr/pt
- [ ] Manual test: Chrome + Safari, mic permission denied recovery

---

## 12) Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| OpenAI Realtime API changes | Pin model id in env; abstract session factory |
| Cost per onboarding session | Session timeout (e.g. 30 min); monitor usage in staging |
| Tool result ↔ UI card drift | Shared tool executors + contract tests on sample payloads |
| Dual history (Realtime + useChat) | Transcript bridge with explicit sync on mode switch |
| CSP blocks WebRTC | Phase 0 staging verification before prod flag |
| Agents SDK bundle size | Lazy-load Realtime hook; dynamic import session module |

---

## 13) References

- V1 implementation: `packages/epics/src/common/use-onboarding-voice-interview.ts`
- Chat route: `apps/web/src/app/api/chat/route.ts`
- Onboarding tools: `packages/chat-server/src/tools/index.ts`
- Voice guidelines: `packages/chat-server/src/system-prompt.ts` (`ONBOARDING_VOICE_INTERVIEW_GUIDELINES`)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Agents SDK — Voice agents](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)
- [OpenAI Realtime MCP](https://platform.openai.com/docs/guides/realtime-mcp)

---

## 14) Open questions for product sign-off

1. **Voice persona** — fixed voice (`marin`) vs locale-mapped voices for de/es/fr/pt?
2. **Billing** — OpenAI Realtime billed separately from OpenRouter; approve staging budget cap?
3. **Session recording** — store audio for QA in Phase 2, or text transcript only?
4. **Extend Realtime to space-context AI panel** — Phase 3 or out of scope indefinitely?
5. **PR split** — implement Phase 2 on #2300 vs child PR from `feat/network-map-p1` after map merges?
