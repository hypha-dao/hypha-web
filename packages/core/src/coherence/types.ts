import type { Attachment } from '../governance/types';
import { CoherencePriority } from './coherence-priorities';
import { CoherenceTag } from './coherence-tags';
import { CoherenceType } from './coherence-types';

export type CoherenceAttachment = Attachment;

export interface CreateCoherenceInput {
  creatorId: number;
  spaceId: number;
  type: CoherenceType;
  priority: CoherencePriority;
  title: string;
  description: string;
  slug?: string;
  roomId?: string;
  archived: boolean;
  tags: CoherenceTag[];
  /** Persisted after optional client-side upload (same contract as proposal attachments). */
  attachments?: (string | CoherenceAttachment)[];
  messages?: number;
  views?: number;
}

export interface UpdateCoherenceInput {
  archived?: boolean;
  roomId?: string;
  messages?: number;
  views?: number;
  attachments?: (string | CoherenceAttachment)[];
}

export type UpdateCoherenceBySlugInput = {
  slug: string;
} & UpdateCoherenceInput;

export type Coherence = {
  id: number;
  creatorId: number;
  createdAt: Date;
  updatedAt: Date;
  type: CoherenceType;
  priority: CoherencePriority;
  title: string;
  description: string;
  slug: string | null;
  roomId?: string;
  archived: boolean;
  tags: CoherenceTag[];
  attachments: (string | CoherenceAttachment)[];
  messages?: number;
  views?: number;
};

export enum Environment {
  DEVELOPMENT = 'development',
  PREVIEW = 'preview',
  PRODUCTION = 'production',
}
