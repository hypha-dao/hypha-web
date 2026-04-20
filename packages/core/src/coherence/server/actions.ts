'use server';

import { CreateCoherenceInput, UpdateCoherenceBySlugInput } from '../types';
import { getDb } from '../../common/server/get-db';
import {
  createCoherence,
  deleteCoherenceBySlug,
  updateCoherenceBySlug,
} from './mutations';
import {
  getCoherenceVoteStateBySlug,
  getMyCoherenceVotesForCoherenceIds,
  setCoherenceVoteBySlug,
} from './vote-mutations';

export async function createCoherenceAction(
  data: CreateCoherenceInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create coherence');
  return createCoherence({ ...data }, { db: getDb({ authToken }) });
}

export async function updateCoherenceBySlugAction(
  data: UpdateCoherenceBySlugInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to update coherence');
  return updateCoherenceBySlug(data, {
    db: getDb({ authToken }),
    authToken,
  });
}

export async function deleteCoherenceBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to delete coherence');
  return deleteCoherenceBySlug(data, {
    db: getDb({ authToken }),
    authToken,
  });
}

export async function setCoherenceVoteBySlugAction(
  data: { slug: string; value: -1 | 0 | 1 },
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to vote');
  return setCoherenceVoteBySlug(
    { ...data, authToken },
    { db: getDb({ authToken }) },
  );
}

export async function getCoherenceVoteStateBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  return getCoherenceVoteStateBySlug(data, {
    db: getDb({ authToken: authToken ?? undefined }),
  });
}

export async function getMyCoherenceVotesForCoherenceIdsAction(
  data: { coherenceIds: number[] },
  { authToken }: { authToken?: string },
) {
  return getMyCoherenceVotesForCoherenceIds(data, {
    db: getDb({ authToken: authToken ?? undefined }),
  });
}
