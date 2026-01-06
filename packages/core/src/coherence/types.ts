import { CoherenceStatus } from './coherence-statuses';
import { CoherenceTag } from './coherence-tags';
import { CoherenceType } from './coherence-types';

export interface CreateCoherenceInput {
  creatorId: number;
  spaceId: number;
  status: CoherenceStatus;
  type: CoherenceType;
  title: string;
  description: string;
  slug?: string;
  roomId?: string;
  archived: boolean;
  tags: CoherenceTag[];
}

export interface UpdateCoherenceInput {
  slug?: string;
  //TODO
}

export type UpdateCoherenceBySlugInput = {
  slug: string;
} & UpdateCoherenceInput;

export type Coherence = {
  id: number;
  creatorId?: number;
  createdAt: Date;
  updatedAt: Date;
  status: CoherenceStatus;
  type: CoherenceType;
  title: string;
  description: string;
  roomId?: string;
  archived: boolean;
  tags: CoherenceTag[];
};
