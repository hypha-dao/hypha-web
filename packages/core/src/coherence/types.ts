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
  archived?: boolean;
  roomId?: string;
  messages?: number;
  views?: number;
}

export type UpdateCoherenceBySlugInput = {
  slug: string;
} & UpdateCoherenceInput;

export interface UpdateCoherenceSignalInput {
  type: CoherenceType;
  priority: CoherencePriority;
  title: string;
  description: string;
  tags: CoherenceTag[];
}

export type UpdateCoherenceSignalBySlugInput = {
  slug: string;
} & UpdateCoherenceSignalInput;

export type Coherence = {
  id: number;
  creatorId: number;
  spaceId?: number | null;
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
  messages?: number;
  views?: number;
};

export enum Environment {
  DEVELOPMENT = 'development',
  PREVIEW = 'preview',
  PRODUCTION = 'production',
}
