export interface CreatorType {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  type?: 'person' | 'space';
}

export interface Creator {
  avatarUrl?: string;
  name?: string;
  surname?: string;
}

export interface Attachment {
  name: string;
  url: string;
}

export enum DocumentState {
  DISCUSSION = 'discussion',
  PROPOSAL = 'proposal',
  AGREEMENT = 'agreement',
}

export interface Document {
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
}
