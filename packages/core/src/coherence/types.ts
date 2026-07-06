import {
  CoherencePriority,
  COHERENCE_PRIORITIES,
} from './coherence-priorities';
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
  dueAt?: Date | null;
  progressStatus?: string | null;
  board?: string | null;
  assigneeIds?: number[];
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
  dueAt?: Date | null;
  progressStatus?: string | null;
  board?: string | null;
  assigneeIds?: number[];
}

export type UpdateCoherenceSignalBySlugInput = {
  slug: string;
} & UpdateCoherenceSignalInput;

export interface PatchCoherenceTaskInput {
  dueAt?: Date | null;
  progressStatus?: string | null;
  board?: string | null;
  assigneeIds?: number[];
}

export type PatchCoherenceTaskBySlugInput = {
  slug: string;
} & PatchCoherenceTaskInput;

export type CoherenceUpvoter = {
  personId: number;
  name: string | null;
  avatarUrl: string | null;
  /** Raw voting power units (wei-scale for token sources, whole votes for 1m1v). */
  votingPower: string;
};

export type CoherenceUpvoteSummary = {
  /** Sum of all upvote voting power in raw units. */
  totalVotingPower: string;
  upvoteCount: number;
  /** Display decimals of the voting power source (0 for 1m1v, 18 for token/voice). */
  tokenDecimals: number;
  /** Voters ordered by voting power, highest first (capped). */
  voters: CoherenceUpvoter[];
  /** The requesting user's own upvote, when authenticated. */
  myUpvote: { votingPower: string; maxVotingPower: string } | null;
};

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
  dueAt: Date | null;
  progressStatus: string | null;
  board: string | null;
  assigneeIds: number[];
  /** Present on list/detail API responses; not stored on the row itself. */
  upvotes?: CoherenceUpvoteSummary;
};

export enum Environment {
  DEVELOPMENT = 'development',
  PREVIEW = 'preview',
  PRODUCTION = 'production',
}

export type { CoherencePriority };
