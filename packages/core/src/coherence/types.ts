import { CoherencePriority } from './coherence-priorities';
import { CoherenceTag } from './coherence-tags';
import { CoherenceType } from './coherence-types';

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
  messages?: number;
  views?: number;
}

export interface UpdateCoherenceInput {
  slug?: string;
  archived?: boolean;
  roomId?: string;
  messages?: number;
  views?: number;
}

export type UpdateCoherenceBySlugInput = {
  slug: string;
} & UpdateCoherenceInput;

export type Coherence = {
  id: number;
  creatorId?: number;
  createdAt: Date;
  updatedAt: Date;
  type: CoherenceType;
  priority: CoherencePriority;
  title: string;
  description: string;
  slug: string;
  roomId?: string;
  archived: boolean;
  tags: CoherenceTag[];
  messages?: number;
  views?: number;
};

export enum Environment {
  DEVELOPMENT = 'development',
  PREVIEW = 'preview',
  PRODUCTION = 'production',
}
