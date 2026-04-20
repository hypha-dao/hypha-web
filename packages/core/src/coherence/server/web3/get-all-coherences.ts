'use server';

import { db } from '@hypha-platform/storage-postgres';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherencePriority } from '../../coherence-priorities';
import { findAllCoherences } from '../queries';
import { Coherence } from '../../types';
import { normalizeCoherence } from './normalize-coherence';

/** Server actions must return JSON-serializable payloads (Date breaks some runtimes). */
function toClientJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isLikelyMissingVoteMigration(message: string): boolean {
  // e.g. "column ... vote_score does not exist" (42P01/42703) or table coherence_votes
  return (
    /vote_score|coherence_votes/i.test(message) &&
    /does not exist|42P01|42703/i.test(message)
  );
}

type GetAllCoherencesInput = {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: 'mostrecent' | 'mostmessages' | 'mostviews' | 'mostvotes';
};

export async function getAllCoherences(
  props: GetAllCoherencesInput = {},
): Promise<Coherence[]> {
  try {
    const coherences = await findAllCoherences({ db }, props);
    const normalized = coherences.map(normalizeCoherence);
    return toClientJson(normalized);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (props.orderBy === 'mostvotes' && isLikelyMissingVoteMigration(msg)) {
      try {
        const coherences = await findAllCoherences(
          { db },
          { ...props, orderBy: 'mostrecent' },
        );
        const normalized = coherences.map(normalizeCoherence);
        return toClientJson(normalized);
      } catch {
        // fall through
      }
    }
    throw new Error('Failed to get coherences', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
