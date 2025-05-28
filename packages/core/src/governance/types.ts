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
  web3ProposalId?: number | null;
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

export interface CreateChangeEntryMethodInput {
  title: string;
  description: string;
  image?: string;
  attachments?: string[];
  slug?: string;
  spaceId: number;
  creatorId: number;
}

export interface UpdateChangeEntryMethodInput {
  image?: string;
  slug?: string;
  attachments?: string[];
  web3ProposalId?: number | null;
}

export type UpdateChangeEntryMethodBySlugInput = {
  slug: string;
} & UpdateChangeEntryMethodInput;
