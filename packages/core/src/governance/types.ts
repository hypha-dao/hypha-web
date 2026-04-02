import { TokenType } from '../common/web3/tokens';

export type Creator = {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  address?: string;
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

export type DocumentStatus = 'accepted' | 'rejected' | 'onVoting';

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
  status?: DocumentStatus;
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

export const REFERENCE_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'CAD',
  'CHF',
  'AUD',
  'HKD',
] as const;

export type ReferenceCurrency = (typeof REFERENCE_CURRENCIES)[number];

export type CreateTokenInput = {
  agreementId?: number;
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  type: TokenType;
  iconUrl?: string;
  transferable: boolean;
  isVotingToken: boolean;
  decaySettings: {
    decayInterval: number;
    decayPercentage: number;
  };
  web3SpaceId: number;
  agreementWeb3Id?: number;
  referencePrice?: number;
  referenceCurrency?: ReferenceCurrency;
};

export type UpdateTokenInput = {
  agreementId?: number;
  agreementWeb3Id?: number;
  address?: string;
  agreementWeb3IdUpdate?: number;
  iconUrl?: string;
  name?: string;
  symbol?: string;
  maxSupply?: number;
  type?: TokenType;
  transferable?: boolean;
  isVotingToken?: boolean;
  decayInterval?: number;
  decayPercentage?: number;
  referencePrice?: number;
  referenceCurrency?: ReferenceCurrency;
  archiveToken?: boolean;
};

/** Matches form `transferWhitelist` / issue-new-token shape; stored in pending token update JSON */
export type TransferWhitelistEntry = {
  type?: 'member' | 'space';
  address: string;
  includeSpaceMembers?: boolean;
};

export type TransferWhitelistFormValue = {
  from?: TransferWhitelistEntry[];
  to?: TransferWhitelistEntry[];
};

export type TokenUpdateData = {
  name?: string;
  symbol?: string;
  maxSupply?: number;
  /** Persisted for form hydration; maps to on-chain `fixedMaxSupply` when limited supply is used */
  maxSupplyTypeValue?: 'immutable' | 'updatable';
  type?: TokenType;
  iconUrl?: string;
  transferable?: boolean;
  isVotingToken?: boolean;
  decayInterval?: number;
  decayPercentage?: number;
  referencePrice?: number;
  referenceCurrency?: ReferenceCurrency;
  archiveToken?: boolean;
  /** Persisted for withdraw/resubmit hydration */
  enableProposalAutoMinting?: boolean;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  /** Off-chain copy for proposal details + resubmit; on-chain uses address lists only */
  transferWhitelist?: TransferWhitelistFormValue;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Runtime check for token update JSON stored in DB / session */
export function isTokenUpdateData(data: unknown): data is TokenUpdateData {
  if (!isRecord(data)) {
    return false;
  }
  const t = data.type;
  if (t !== undefined && typeof t !== 'string') {
    return false;
  }
  return true;
}

export type CreateTokenUpdateInput = {
  documentId: number;
  tokenAddress: string;
  data: TokenUpdateData;
};

export type DeleteTokenInput = {
  id: bigint;
};

export interface OnProposalCreatedInput {
  creator: `0x${string}`;
  web3ProposalId: bigint;
  web3SpaceId: bigint;
}
