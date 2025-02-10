export enum DocumentState {
  DISCUSSION = 'discussion',
  PROPOSAL = 'proposal',
  AGREEMENT = 'agreement',
}

export type Document = {
  id: number;
  creatorId: number;
  title?: string;
  description?: string;
  slug: string;
  state: DocumentState;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDocument = {
  creatorId: number;
  title?: string | null;
  description?: string | null;
  slug?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};
