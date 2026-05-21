export interface NotifyProposalCreatedInput {
  proposalId: bigint;
  spaceId: bigint;
  creator: `0x${string}`;
  url?: string;
}
export interface NotifyProposalAcceptedInput {
  proposalId: bigint;
}
export interface NotifyProposalRejectedInput {
  proposalId: bigint;
}

export interface NotifyChatMentionInput {
  actorSlug?: string;
  actorDisplayName?: string;
  mentionMatrixUserIds: string[];
  messagePreview?: string;
  url: string;
}

export interface PostNotifyProposalCreatedInput
  extends NotifyProposalCreatedInput {
  sendNotifications?: (arg: NotifyProposalCreatedInput) => Promise<void>;
}

export interface UseSendNotificationsReturn {
  notifyProposalCreated: (arg: NotifyProposalCreatedInput) => Promise<void>;
  notifyProposalAccepted: (arg: NotifyProposalAcceptedInput) => Promise<void>;
  notifyProposalRejected: (arg: NotifyProposalRejectedInput) => Promise<void>;
  notifyChatMention: (arg: NotifyChatMentionInput) => Promise<void>;
}

export interface UseSendNotificationsInput {
  authToken?: string | null;
}

export type UseSendNotificationsHook = ({
  authToken,
}: UseSendNotificationsInput) => UseSendNotificationsReturn;
