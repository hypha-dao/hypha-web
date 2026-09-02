# ai-bot-poc — #2485 (throwaway)

Time-boxed proof that a **mention-invoked AI agent** living in Hypha's Matrix rooms — answering
from `hypha-context` and optionally taking an action — is reachable now on top of #2428 (outbound
AS bot) + #2483 (inbound AS receiver). For the Build Council call; see
`hypha-context/progress/members/gerroza/tickets/2485-matrix-ai-bot-poc/`.

**This is expected to be partly throwaway.** The reusable surface (persona registry, room-scoped
context loader, reply plumbing, action-tool bridge) gets split into its own ticket after the shape
is clear (#2478 discussion).

## Shape

```
pocDispatch(event)                     ← wraps #2483 loggingDispatch (Callout 1: wrap, not replace)
  └─ loggingDispatch(event)            ← #2470 stub, always runs first, unchanged
  └─ handlePocEvent(event)             ← fully guarded; any throw is logged, never bubbles
       ├─ filter: chat.mention + a known @hyphabot_* + not bot-authored (loop guard)
       ├─ personas.ts        → resolve persona by localpart
       ├─ context-source.ts  → pinned files + repo-scoped read_file tool
       ├─ llm.ts             → OpenRouter (strategy chain) generateText, stepCountIs(4)
       ├─ signal-tool.ts     → create_signal (STUB — see file header, Callout 4 outcome)
       └─ matrix-out.ts      → postAs(persona, roomId, text) via AS-token puppet
```

## Wiring (both revert cleanly)

- `apps/web/src/app/api/matrix/appservice/transactions/[txnId]/route.ts` — `dispatch: pocDispatch`
- `apps/web/src/app/api/cron/notification-reconcile/route.ts` — `dispatch: pocDispatch`
- `packages/notifications/.../types.ts` + `ingest-message.ts` — added `roomId` to
  `ChatNotificationEvent` (additive; the POC needs the room to reply). Pre-authorised by the plan.

## Env (POC-only)

| var | purpose |
|---|---|
| `HYPHA_CONTEXT_REPO_PATH` | absolute path to the local `hypha-context` checkout |
| `AI_BOT_POC_HOMESERVER` | server name for `@hyphabot_*:<name>` MXIDs (e.g. `matrix.test`) |
| `AI_BOT_POC_MODEL` | optional model id override (OpenRouter form) |
| `AI_BOT_POC_AS_TOKEN` | optional; only if a separate AS registration is used |
| `OPENROUTER_API_KEY` | required — the LLM provider |

Reused unchanged: `HYPHA_MATRIX_BOT_AS_TOKEN`, `NEXT_PUBLIC_MATRIX_HOMESERVER_URL`,
`NEXT_PUBLIC_MATRIX_BOT_USER_ID`. If any required var is missing, `pocDispatch` no-ops after a
one-time warn — the #2483 path is unaffected.

## Teardown

Delete this folder, revert `dispatch: pocDispatch` → `dispatch: loggingDispatch` in the two routes,
revert the `roomId` field, drop the POC env vars. Remove the `@hyphabot_.*` line from
`hypha-as.yaml` and restart Dendrite.
