/**
 * `proposal.created`/`accepted`/`rejected` and `signal.assigned` notifications are server-fired
 * (#2470) — the former from `apps/web/.../webhooks/proposal/*`, the latter from
 * `createCoherenceAction`/`updateCoherenceSignalBySlugAction` — both via `dispatch()`, not
 * client-triggered. No `notifyProposal*`/`notifySignalAssigned` methods on
 * `UseSendNotificationsReturn` below. `NotifyProposalCreatedInput` survives only because
 * `PostNotifyProposalCreatedInput` (the on-chain-event → routing callback used after publishing a
 * proposal) still needs its shape.
 */
export interface NotifyProposalCreatedInput {
  proposalId: bigint;
  spaceId: bigint;
  creator: `0x${string}`;
  url?: string;
}

export interface NotifyChatMentionInput {
  actorSlug?: string;
  actorDisplayName?: string;
  mentionMatrixUserIds: string[];
  messagePreview?: string;
  /** Human-readable context, e.g. signal title or space name — used in email copy. */
  contextLabel?: string;
  url: string;
}

export type NotifyCallStartedScope = 'space_members' | 'signal_team';

export interface NotifyCallStartedInput {
  actorSlug?: string;
  actorDisplayName?: string;
  spaceSlug: string;
  contextLabel?: string;
  scope: NotifyCallStartedScope;
  targetMatrixUserIds?: string[];
  url: string;
}

export type PostNotifyProposalCreatedInput = NotifyProposalCreatedInput;

export interface UseSendNotificationsReturn {
  notifyChatMention: (arg: NotifyChatMentionInput) => Promise<void>;
  notifyCallStarted: (arg: NotifyCallStartedInput) => Promise<void>;
}

export interface UseSendNotificationsInput {
  authToken?: string | null;
}

export type UseSendNotificationsHook = ({
  authToken,
}: UseSendNotificationsInput) => UseSendNotificationsReturn;
