export type Creator = {
  avatarUrl?: string;
  name?: string;
  surname?: string;
};

export enum DocumentState {
  DISCUSSION = 'discussion',
  PROPOSAL = 'proposal',
  AGREEMENT = 'agreement',
}

export enum EntryMethodType {
  OPEN_ACCESS = 0,
  TOKEN_BASED = 1,
  INVITE_ONLY = 2,
}

interface Transaction {
  target: string;
  value: number;
  data: string | Uint8Array;
}

export interface Attachment {
  name: string;
  url: string;
}

export type Document = {
  id: number;
  creatorId: number;
  title: string;
  description?: string;
  slug?: string;
  state: DocumentState;
  createdAt: Date;
  updatedAt: Date;
  creator?: Creator;
  leadImage?: string;
  attachments?: (string | Attachment)[];
  web3ProposalId: number | null;
  label?: string;
  status?: 'accepted' | 'rejected' | 'onVoting';
};

export interface CreateAgreementInput {
  title: string;
  description: string;
  leadImage?: string;
  attachments?: (string | Attachment)[];
  web3ProposalId?: number;
  state?: DocumentState;
  slug?: string;
  spaceId: number;
  creatorId: number;
  label?: string;
}

export interface UpdateAgreementInput {
  leadImage?: string;
  slug?: string;
  attachments?: (string | Attachment)[];
  web3ProposalId?: number | null;
}

export type UpdateAgreementBySlugInput = {
  slug: string;
} & UpdateAgreementInput;

export interface CreateChangeEntryMethodInput {
  title: string;
  description: string;
  image?: string;
  attachments?: (string | Attachment)[];
  slug?: string;
  spaceId: number;
  creatorId: number;
}

export interface UpdateChangeEntryMethodInput {
  image?: string;
  slug?: string;
  attachments?: (string | Attachment)[];
  web3ProposalId?: number | null;
}

export type UpdateChangeEntryMethodBySlugInput = {
  slug: string;
} & UpdateChangeEntryMethodInput;

export type Address = `0x${string}`;

export type TokenBase = {
  amount: number;
  token: Address;
};

export type CreateTokenInput = {
  agreementId?: number;
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  type: 'utility' | 'credits' | 'ownership' | 'voice';
  iconUrl?: string;
  transferable: boolean;
  isVotingToken: boolean;
  decaySettings: {
    decayInterval: number;
    decayPercentage: number;
  };
  web3SpaceId: number;
  agreementWeb3Id?: number;
};

export type UpdateTokenInput = {
  agreementId?: number;
  agreementWeb3Id?: number;
  address?: string;
  agreementWeb3IdUpdate?: number;
};

export type DeleteTokenInput = {
  id: bigint;
};
