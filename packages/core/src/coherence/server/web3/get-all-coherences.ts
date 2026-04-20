'use server';

import { db } from '@hypha-platform/storage-postgres';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherencePriority } from '../../coherence-priorities';
import { findAllCoherences } from '../queries';
import { Coherence } from '../../types';
import { normalizeCoherence } from './normalize-coherence';
import { toClientJson } from '../serialize-client-json';

function isLikelyMissingVoteMigration(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code ?? '')
      : '';
  const message = err instanceof Error ? err.message : String(err);
  if (code === '42703' || code === '42P01') {
    return /vote_score|coherence_votes/i.test(message);
  }
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
    if (props.orderBy === 'mostvotes' && isLikelyMissingVoteMigration(error)) {
      try {
        const coherences = await findAllCoherences(
          { db },
          { ...props, orderBy: 'mostrecent' },
        );
        const normalized = coherences.map(normalizeCoherence);
        return toClientJson(normalized);
      } catch (fallbackErr) {
        console.warn(
          '[getAllCoherences] mostvotes fallback after missing vote migration detection failed',
          fallbackErr,
        );
      }
    }
    throw new Error('Failed to get coherences', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
