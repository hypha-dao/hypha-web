import {
  CoherencePriority,
  COHERENCE_PRIORITIES,
} from './coherence-priorities';
import { CoherenceTag } from './coherence-tags';
import { CoherenceType } from './coherence-types';
import type { CapitalKey } from '../network/capitals';

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
  /** Forms of capital this signal carries. Omitted means none. */
  capitals?: CapitalKey[];
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
  /** Omit to leave the named forms of capital alone. */
  capitals?: CapitalKey[];
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

/** One person holds one row. `up` is the historical default. */
export type SignalVoteDirection = 'up' | 'down';

export type CoherenceUpvoter = {
  personId: number;
  name: string | null;
  avatarUrl: string | null;
  /** Raw voting power units (wei-scale for token sources, whole votes for 1m1v). */
  votingPower: string;
  /** Missing on older payloads; treat as an upvote. */
  direction?: SignalVoteDirection;
};

export type CoherenceUpvoteSummary = {
  /**
   * Net voting power in raw units: upvotes minus downvotes.
   * Existing rows are upvotes, so an all-up signal matches the old sum.
   */
  totalVotingPower: string;
  /** People who voted up. */
  upvoteCount: number;
  /** People who voted down. */
  downvoteCount: number;
  /** Positive raw power cast up, before the net. */
  upVotingPower: string;
  /** Positive raw power cast down, before the net. */
  downVotingPower: string;
  /** Upvoters minus downvoters. Rankings and the count cell use this. */
  netVoteCount: number;
  /** Display decimals of the voting power source (0 for 1m1v, 18 for token/voice). */
  tokenDecimals: number;
  /** Voters ordered by voting power, highest first. */
  voters: CoherenceUpvoter[];
  /** The requesting user's own vote, when authenticated. */
  myUpvote: {
    votingPower: string;
    maxVotingPower: string;
    /** Missing on older payloads; treat as an upvote. */
    direction?: SignalVoteDirection;
  } | null;
  /**
   * Net support inside each trailing window, all voters (not capped).
   * A vote counts from the last time its direction was written.
   */
  recentUpvotes?: Record<SignalRecentWindow, SignalWindowUpvotes>;
};

/** Trailing windows: past hour, 24 hours, 7, 30 and 365 days. */
export type SignalRecentWindow = 'now' | 'today' | 'week' | 'month' | 'year';

export type SignalWindowUpvotes = {
  /** Net voting power in raw units (up minus down). */
  votingPower: string;
  /** Upvoters minus downvoters. */
  voters: number;
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
  assigneeAcknowledgedAt: Record<string, string>;
  deadlineNotifyState: {
    dueAtIso?: string | null;
    reminderSentAt?: string | null;
    overdueSentAt?: string | null;
  };
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
  /** Forms of capital named on this signal. Empty when none are named. */
  capitals: CapitalKey[];
  /** Present on list/detail API responses; not stored on the row itself. */
  upvotes?: CoherenceUpvoteSummary;
};

export enum Environment {
  DEVELOPMENT = 'development',
  PREVIEW = 'preview',
  PRODUCTION = 'production',
}

export type { CoherencePriority };
