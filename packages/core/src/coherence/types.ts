import {
  CoherencePriority,
  COHERENCE_PRIORITIES,
} from './coherence-priorities';
import { CoherenceTag } from './coherence-tags';
import { CoherenceType } from './coherence-types';

/** Indicative amount on a signal. `token` is the token address, same as a proposal payout. */
export type IndicativePayout = {
  amount: string;
  token: string;
};

/** A document linked on a signal. Same shape as a proposal attachment. */
export type SignalAttachment = {
  name: string;
  url: string;
};

export interface CreateCoherenceInput {
  /** Null for system/automated signals with no attributable requesting user. */
  creatorId: number | null;
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
  /** Amounts that name the ask. Omitted means none. Never a transfer. */
  indicativePayouts?: IndicativePayout[];
  leadImage?: string | null;
  videoUrl?: string | null;
  attachments?: SignalAttachment[];
  /**
   * Share this signal beyond its space so it can be offered to other members.
   * Omitted means no.
   */
  sharedWithNetwork?: boolean;
  /** `space_api_keys.source` when written by a community app integration. */
  source?: string | null;
  /** The integration's own identifier for the record, used for idempotency. */
  externalId?: string | null;
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
  indicativePayouts?: IndicativePayout[];
  leadImage?: string | null;
  videoUrl?: string | null;
  attachments?: SignalAttachment[];
  /** Omit to leave sharing alone. */
  sharedWithNetwork?: boolean;
  /** Omit to leave the archived state alone; set it to change it in the same write. */
  archived?: boolean;
}

export type UpdateCoherenceSignalBySlugInput = {
  slug: string;
} & UpdateCoherenceSignalInput;

export interface PatchCoherenceTaskInput {
  dueAt?: Date | null;
  progressStatus?: string | null;
  board?: string | null;
  assigneeIds?: number[];
  priority?: CoherencePriority;
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
  creatorId: number | null;
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
  /** Amounts that name the ask or resource. They do not move funds. */
  indicativePayouts: IndicativePayout[];
  leadImage: string | null;
  videoUrl: string | null;
  attachments: SignalAttachment[];
  /** True when members outside this space may be offered this signal. */
  sharedWithNetwork: boolean;
  /** `space_api_keys.source` when written by a community app integration. */
  source: string | null;
  /** The integration's own identifier for the record. */
  externalId: string | null;
  /** Present on list/detail API responses; not stored on the row itself. */
  upvotes?: CoherenceUpvoteSummary;
};

export enum Environment {
  DEVELOPMENT = 'development',
  PREVIEW = 'preview',
  PRODUCTION = 'production',
}

export type { CoherencePriority };
