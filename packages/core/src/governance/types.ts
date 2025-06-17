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

interface Transaction {
  target: string;
  value: number;
  data: string | Uint8Array;
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
  attachments?: string[];
  web3ProposalId: number | null;
  status?: 'accepted' | 'rejected' | 'onVoting';
};

export interface CreateAgreementInput {
  title: string;
  description: string;
  leadImage?: string;
  attachments?: string[];
  slug?: string;
  spaceId: number;
  creatorId: number;
}

export interface UpdateAgreementInput {
  leadImage?: string;
  slug?: string;
  attachments?: string[];
  web3ProposalId?: number | null;
}

export type UpdateAgreementBySlugInput = {
  slug: string;
} & UpdateAgreementInput;
