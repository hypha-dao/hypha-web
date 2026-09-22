/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Notification decision layer — shared types (#2470)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two hard layers with a port between them (implementation-plan.md §2):
 *  - decision (this file + `recipient-resolver.ts` / `strategy.ts` / `consent-gate.ts` /
 *    `dispatch.ts`): who gets notified, Hypha-owned.
 *  - delivery (`../delivery/*`): how/when a decided notification actually goes out,
 *    behind the `NotificationDispatcher` port, swappable.
 *
 * Adding an event type is: a new discriminated-union member + a resolver + a content builder
 * registered in `registry.ts` — `dispatch()` itself never changes.
 */
import type { ScheduledItem } from '@hypha-platform/core/client';
import type { LangMap } from '../sdk/types';
import type { ChatNotificationEvent } from '../ingest/matrix-as/types';

export type { ChatNotificationEvent } from '../ingest/matrix-as/types';

export interface Recipient {
  personSlug: string;
  displayName?: string;
  matrixUserId?: string;
  /**
   * Event-type-specific role a resolver may attach (e.g. `'creator' | 'member'` for proposal
   * events). Opaque to the dispatcher and `ConsentGate` — only that event type's content
   * builder reads it.
   */
  role?: string;
  /**
   * Event-type-specific data the resolver already had on hand (e.g. space title) that a
   * content builder needs. Opaque bag, not read by the dispatcher or `ConsentGate`.
   */
  data?: Record<string, unknown>;
}

export interface ProposalCreatedEvent {
  type: 'proposal.created';
  source: { kind: 'domain'; entityType: 'proposal'; entityId: string };
  context: {
    proposalWeb3Id: bigint;
    spaceWeb3Id: bigint;
    creatorWeb3Address: `0x${string}`;
  };
  /** `'Invite'` for a join-space request proposal (see `decodeJoinRequestProposal`), undefined otherwise. */
  payload: { proposalLabel?: string };
}

export interface ProposalAcceptedEvent {
  type: 'proposal.accepted';
  source: { kind: 'domain'; entityType: 'proposal'; entityId: string };
  context: { proposalWeb3Id: number };
}

export interface ProposalRejectedEvent {
  type: 'proposal.rejected';
  source: { kind: 'domain'; entityType: 'proposal'; entityId: string };
  context: { proposalWeb3Id: number };
}

export interface SignalAssignedEvent {
  type: 'signal.assigned';
  source: { kind: 'domain'; entityType: 'coherence'; entityId: string };
  context: {
    spaceId: number;
    /** Newly-added assignees only (diffed against the previous assignee list by the caller). */
    assigneePersonIds: number[];
    /** The caller — resolved server-side from the mutation's own auth, never notified about their own assignment. */
    actorPersonId: number | null;
  };
  payload: { signalSlug: string; signalTitle: string };
}

export interface ScheduledItemInvitedEvent {
  type: 'scheduled_item.invited';
  source: { kind: 'domain'; entityType: 'scheduled_item'; entityId: string };
  /** The resolver needs the full item (`resolveScheduledItemRecipientSlugs` reads `spaceId`/`creatorId`/`coherenceId`). */
  context: { item: ScheduledItem };
  payload: {
    title: string;
    description: string | null;
    spaceTitle: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string | null;
    joinUrl: string;
    /** Pre-claimed by the caller's idempotency guard (`dispatch-scheduled-item-invitation.ts`) — only these channels are requested. */
    channels: Array<'email' | 'push'>;
    lang: string;
  };
}

export type NotificationEvent =
  | ProposalCreatedEvent
  | ProposalAcceptedEvent
  | ProposalRejectedEvent
  | SignalAssignedEvent
  | ScheduledItemInvitedEvent
  | ChatNotificationEvent;

export type NotificationChannel = 'push' | 'email' | 'in_app';

/**
 * `'template'` — a remote OneSignal-dashboard template (`templateId` + `customData`).
 * `'plain'` — content rendered locally (this codebase's `template/push/*` functions), sent as
 * ad hoc `{contents, headings}` — no OneSignal dashboard template required.
 */
export type NotificationPushContent =
  | {
      kind: 'template';
      templateId: string;
      customData?: Record<string, string>;
      url?: string;
    }
  | { kind: 'plain'; contents: LangMap; headings?: LangMap; url?: string };

/** Same `template` / `plain` split as `NotificationPushContent`, mirroring `template/email/*`. */
export type NotificationEmailContent =
  | {
      kind: 'template';
      templateId: string;
      customData?: Record<string, string>;
    }
  | { kind: 'plain'; subject: string; body: string };

export interface ChannelContent {
  push?: NotificationPushContent;
  email?: NotificationEmailContent;
}

/** What one recipient of one event should receive, before consent gating narrows `channels`. */
export interface NotificationContent {
  channels: NotificationChannel[];
  /** OneSignal tags required for a channel to be allowed — passed to `ConsentGate`. */
  requiredTags: Record<string, string>;
  content: ChannelContent;
}

/** The decision layer's output for one recipient, after consent gating — this is what crosses the port into delivery. */
export interface DecidedNotification {
  recipient: Recipient;
  channels: NotificationChannel[];
  content: ChannelContent;
}
