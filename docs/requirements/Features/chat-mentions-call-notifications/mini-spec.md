# Mini spec: chat mentions & call-start notifications

**Status:** Implementing  
**Branch context:** `spec/call-world-class-ux` / notification parity work

## Problem

Users expect Discord-like alerts when:

1. Someone **@mentions** them in space chat or a signal thread
2. Someone **starts a call** in a space room they belong to, or in a signal thread where they are on the team

They should receive **desktop push** and/or **email** based on Notification Centre preferences, see an **unread count on the bell**, and find the event in the **Mentions inbox**.

## Current state (audit)

| Capability | In-app bell + inbox | OneSignal push | Email | Notes |
|------------|--------------------:|---------------:|------:|-------|
| @mention in space room | Yes | Yes* | Yes* | Client fires after send |
| @mention in signal thread | Yes | **No** | **No** | Gated by `mode === 'space'` |
| Call started (space) | Local chime only | **No** | **No** | Browser `Notification` when tab hidden |
| Call started (thread / team) | Local chime only | **No** | **No** | No team-scoped fanout |

\*Requires Notification Centre: subscribed + channel (push/email) + **mention consent** (`consent_mentions`).

**Known bug:** `send-push.ts` overwrites custom headings with `"Hypha"`, breaking mention push titles.

**Preferences:** OneSignal tags — no Postgres notification table. Mention consent checkbox controls `consent_mentions` and applies to both mention and call alerts in this iteration.

## Scope (this iteration)

### In scope

1. **Fix push headings** — preserve actor-specific titles
2. **Thread @mention fanout** — send push/email for coherence/signal thread mentions with correct deep links
3. **Call-start fanout** — OneSignal push + email when a user **starts** a call (first joiner, not when joining an existing call)
4. **Recipient rules**
   - Space room call → all space members (DB membership roster), excluding caller
   - Thread call with signal team policy → signal team MXIDs only, excluding caller
   - Thread call without team policy → space members (same as space room)
5. **Preference gate** — reuse `consent_mentions` + push/email channel tags (same as mentions)
6. **In-app UX** — bell badge + mention inbox already Matrix-driven; no schema change

### Out of scope (follow-up)

- Idempotency store per event/recipient
- Matrix webhook / server-side mention dispatcher
- Per-room mute / mentions-only Matrix push rules
- Separate “call alerts” consent toggle (uses mention consent for now)
- OneSignal templated emails for calls

## Architecture

```
Client (HumanRightPanel)
  ├─ after send with @mentions → notifyChatMentionAction (space + thread)
  └─ on call connected (first joiner) → notifyCallStartedAction

Server action (@hypha-platform/notifications)
  ├─ Privy auth token validation
  ├─ Resolve recipient person.slug[]
  │    ├─ mentions: matrix_user_links for target MXIDs
  │    └─ calls: space memberships OR signal team MXIDs
  └─ sendPushNotifications + sendEmailNotifications
       filter: subscribed + push/email + consent_mentions
```

## Deep links

| Event | URL pattern |
|-------|-------------|
| Space mention | `/{lang}/dho/{spaceSlug}?msg={eventId}&chat={roomId}` |
| Thread mention | `/{lang}/dho/{spaceSlug}?signal={coherenceSlug}&msg={eventId}&chat={roomId}` |
| Space call | `/{lang}/dho/{spaceSlug}?joinCall=1` |
| Thread call | `/{lang}/dho/{spaceSlug}?joinCall=1&signal={coherenceSlug}` |

## Acceptance criteria

- **AC-1** @mention in signal thread sends push/email to targeted team members with mention consent enabled
- **AC-2** Starting a space call notifies other space members (push/email per preferences)
- **AC-3** Starting a thread call notifies signal team members only when team policy is active
- **AC-4** Joining an existing call does not re-notify everyone
- **AC-5** Push notification title shows actor name (not generic “Hypha”)
- **AC-6** Bell badge and mention inbox continue to reflect Matrix `m.mentions` unread state

## Files

| File | Change |
|------|--------|
| `packages/notifications/src/sdk/send-push.ts` | Preserve headings |
| `packages/notifications/src/actions/notify-call-started.ts` | New server action |
| `packages/core/.../use-send-notifications.ts` | Types + hook surface |
| `packages/notifications/.../use-send-notifications.ts` | Wire action |
| `packages/epics/.../human-right-panel.tsx` | Triggers |
| `packages/i18n/src/messages/*.json` | Consent copy clarifies calls + threads |
