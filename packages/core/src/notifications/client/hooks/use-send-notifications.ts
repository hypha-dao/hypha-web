/**
 * `proposal.created`/`accepted`/`rejected`, `signal.assigned`, and `chat.mention`/`chat.message`
 * notifications are server-fired (#2470) — proposals from `apps/web/.../webhooks/proposal/*`,
 * signal-assignment from `createCoherenceAction`/`updateCoherenceSignalBySlugAction`, chat from
 * the `#2483` AS receiver — all via `dispatch()`, not client-triggered. No
 * `notifyProposal*`/`notifySignalAssigned`/`notifyChatMention` methods on
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
  notifyCallStarted: (arg: NotifyCallStartedInput) => Promise<void>;
}

export interface UseSendNotificationsInput {
  authToken?: string | null;
}

export type UseSendNotificationsHook = ({
  authToken,
}: UseSendNotificationsInput) => UseSendNotificationsReturn;
