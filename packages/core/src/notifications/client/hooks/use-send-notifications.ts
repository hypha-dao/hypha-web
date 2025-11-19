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

export interface UseSendNotificationsReturn {
  notifyProposalCreated: (arg: NotifyProposalCreatedInput) => Promise<void>;
  notifyProposalAccepted: (arg: NotifyProposalAcceptedInput) => Promise<{}>;
  notifyProposalRejected: (arg: NotifyProposalRejectedInput) => Promise<{}>;
}

export interface UseSendNotificationsInput {
  authToken?: string | null;
}

export type UseSendNotificationsHook = ({
  authToken,
}: UseSendNotificationsInput) => UseSendNotificationsReturn;
