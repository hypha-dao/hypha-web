# Discord-parity chat mentions and notifications

**Status:** Ready for implementation  
**Primary objective:** Restore reliable `@` mention behavior in room + thread chat and deliver multi-channel notifications that bring users back to the platform.

## 1. Problem statement

Current behavior is below user expectations for real-time collaboration:

- `@` mention flow is unreliable in thread context.
- Mention-triggered notifications are not consistently delivered.
- Users outside the app are not reliably re-engaged by desktop/mobile/email alerts.
- Mention navigation and unread mention feedback are weaker than Discord-like products.

This specification defines a production-ready, implementable path to fix mention reliability and establish Discord-comparable notification UX.

## 2. Scope

In scope:

- Mention creation in room chat and thread chat (Matrix-backed).
- Mention unread badge on bell icon with read/unread lifecycle.
- Mention inbox list with click-through to exact thread/message.
- Notification fanout for mentions: desktop push, mobile push, and one email per mention.
- Notification centre consent control for mention notifications.
- OneSignal integration contract and delivery guarantees.

Out of scope:

- Non-mention notification classes (reactions, joins, follows, digest emails).
- Full thread-level server-side push rules beyond room-level Matrix capabilities.
- Notification provider migration away from OneSignal.

## 3. Existing touchpoints

- Mention parsing/sending: `packages/core/src/matrix/mentions.ts`
- Chat composer + mention picker: `packages/epics/src/common/human-chat-panel/human-chat-panel-chat-bar.tsx`
- Mention inbox UI: `packages/epics/src/common/human-chat-panel/human-chat-panel-mention-inbox.tsx`
- OneSignal integration: `packages/notifications/src/sdk/send-push.ts`
- OneSignal package docs: `packages/notifications/README.md`

## 4. User stories

1. As a user, I can `@` mention someone in room and thread chat so they are explicitly notified.
2. As a mentioned user, I receive a notification when I am offline (desktop/mobile) and an email with a deep link.
3. As a mentioned user, I see an unread mention counter on the bell until I read the mention.
4. As a user, I can open a mentions list and click any mention to navigate to the correct thread and message.
5. As a power user, I can control mention notification preferences without missing critical messages.

## 5. Functional requirements

### 5.1 Mention creation and send pipeline

**FR-1** The system SHALL support mention insertion from the composer in both room and thread contexts.

**FR-2** The system SHALL include Matrix intentional mentions (`m.mentions.user_ids`) on every outgoing message containing mention tokens.

**FR-3** The system SHALL preserve mention metadata when sending replies and thread messages.

**FR-4** The system SHALL resolve mention candidates from room membership and reject invalid/stale targets.

### 5.2 Mention unread and bell behavior

**FR-5** The bell icon SHALL display the unread mention count for the signed-in user.

**FR-6** The unread mention count SHALL decrement only when a mention is marked as read (navigated + read receipt or explicit mark-read action).

**FR-7** The counter SHALL disappear when unread mention count reaches zero.

### 5.3 Mention inbox and navigation

**FR-8** The mentions inbox SHALL list mention events sorted by newest first.

**FR-9** Each mention row SHALL include sender, context label (space/room/thread), excerpt, and timestamp.

**FR-10** Clicking a mention row SHALL navigate to the exact target thread/message.

**FR-11** If direct navigation fails (message unavailable), the system SHALL fall back to thread root and show a non-blocking error message.

### 5.4 OneSignal-driven delivery

**FR-12** For each new mention, the system SHALL send a desktop push notification when the user has an active web push subscription.

**FR-13** For each new mention, the system SHALL send a mobile push notification when the user has an active mobile subscription.

**FR-14** For each new mention, the system SHALL send one email notification containing a deep link to the exact thread/message.

**FR-15** Notification payloads SHALL include stable deep-link identifiers (`spaceSlug`, `roomId`, `threadRootEventId`, `eventId`) to reconstruct navigation.

**FR-16** The send pipeline SHALL be idempotent per mention event and recipient, preventing duplicate push/email sends.

### 5.5 Preferences and policy

**FR-17** Users SHALL be able to choose per-context notification policy: `All messages`, `Mentions only`, `Muted`.

**FR-18** Mention notifications SHALL respect user-level channel preferences (desktop push/email/mobile push toggles).

**FR-19** The notification centre SHALL include an explicit user consent control for mention notifications (for example: `Allow mention notifications`) that applies across delivery channels unless a stricter per-channel opt-out is selected.

**FR-20** The mention-consent value SHALL be persisted with user notification preferences and SHALL default to `enabled` for existing users unless legal/product policy requires opt-in by region.

**FR-21** If mention consent is disabled, the system SHALL suppress mention-triggered desktop push, mobile push, and mention emails for that user.

## 6. Non-functional requirements

**NFR-1 (Latency)** Mention-triggered push and email dispatch SHALL be initiated within 60 seconds of mention event creation.

**NFR-2 (Reliability)** Notification pipeline SHALL provide at-least-once delivery attempts with dedupe guarantees.

**NFR-3 (Observability)** System SHALL log mention notification lifecycle states: `queued`, `sent`, `provider_accepted`, `provider_failed`, `opened`, `clicked`.

**NFR-4 (Security)** Deep links SHALL require normal application auth and SHALL never expose private content via unauthenticated endpoints.

**NFR-5 (Accessibility)** Bell badge and mention inbox interactions SHALL be keyboard/screen-reader accessible.

## 7. Data and integration contract

### 7.1 Mention event envelope

Each mention event SHALL include at minimum:

- `mentionEventId` (idempotency key seed)
- `actorMatrixUserId`
- `targetMatrixUserId`
- `roomId`
- `threadRootEventId` (nullable)
- `messageEventId`
- `createdAt`

### 7.2 OneSignal payload contract

Push/email payload SHALL include:

- Title: `"{actorName} mentioned you"`
- Body/excerpt: truncated message preview
- URL/deep link: canonical route to the referenced thread/message
- Data payload keys: `roomId`, `threadRootEventId`, `eventId`, `spaceSlug`, `type="mention"`

## 8. Implementation decomposition

1. **Mention reliability hardening**
   - Validate thread mention parsing and send in Matrix provider path.
   - Ensure `m.mentions` survives reply/thread relation wrappers.
2. **Unread mention source of truth**
   - Consolidate unread mention counting (highlight + mention event list alignment).
   - Define read transition behavior and persistence.
3. **Navigation correctness**
   - Standardize mention deep-link resolver and fallback behavior.
4. **Notification dispatcher**
   - Add mention-triggered server action/job using OneSignal alias targeting.
   - Add idempotency storage/check.
5. **Email parity**
   - Add mention email template and per-mention send path.
6. **Mobile parity**
   - Verify mobile subscription identifiers and payload compatibility.
7. **Preference enforcement**
   - Gate sends by room policy and channel-level user preferences.
   - Add notification centre mention-consent control and include it in save/load validation.
8. **Instrumentation + dashboards**
   - Add metrics and logs for delivery and click/open outcomes.

## 9. Acceptance criteria

**AC-1** Given a user mentions another user in a thread, when message is sent, then target receives a valid mention event and `m.mentions` includes target ID.

**AC-2** Given target user is offline with desktop/mobile subscriptions, when mentioned, then desktop and mobile notifications are delivered with valid deep links.

**AC-3** Given target user has email mentions enabled, when mentioned, then one email is sent for that mention with a deep link to the correct thread/message.

**AC-4** Given unread mentions exist, when viewing chat header, then bell shows exact unread mention count.

**AC-5** Given user opens mention from inbox, when navigation completes, then the correct thread/message is visible and unread count updates accordingly.

**AC-6** Given all unread mentions are read, when header re-renders, then bell counter is hidden.

**AC-7** Given a user disables mention consent in notification centre, when another user mentions them, then no mention push/email/mobile notification is sent.

## 10. Discord-comparable improvements (recommended follow-ups)

1. Add per-server/per-channel notification presets with bulk controls.
2. Add mention digest fallback (15m/1h) only for users who disable per-mention emails.
3. Add “inbox triage” actions: mark read, snooze, mute thread, jump to first unread.
4. Add notification sound controls and quiet hours by timezone.
5. Add trust indicators: “delivered”, “opened”, and “last notified” for debugging silent failures.
6. Add anti-spam controls: suppress repeated mention bursts from same actor within short windows.
