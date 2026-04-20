'use server';

import { CreateCoherenceInput, UpdateCoherenceBySlugInput } from '../types';
import { getDb } from '../../common/server/get-db';
import { toClientJson } from './serialize-client-json';
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
  const row = await createCoherence({ ...data }, { db: getDb({ authToken }) });
  return toClientJson(row);
}

export async function updateCoherenceBySlugAction(
  data: UpdateCoherenceBySlugInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to update coherence');
  const row = await updateCoherenceBySlug(data, {
    db: getDb({ authToken }),
    authToken,
  });
  return toClientJson(row);
}

export async function deleteCoherenceBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to delete coherence');
  const row = await deleteCoherenceBySlug(data, {
    db: getDb({ authToken }),
    authToken,
  });
  return toClientJson(row);
}

export async function setCoherenceVoteBySlugAction(
  data: { slug: string; value: -1 | 0 | 1 },
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to vote');
  const normalized = await setCoherenceVoteBySlug(
    { ...data, authToken },
    { db: getDb({ authToken }) },
  );
  return toClientJson(normalized);
}

export async function getCoherenceVoteStateBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  const state = await getCoherenceVoteStateBySlug(data, {
    db: getDb({ authToken: authToken ?? undefined }),
  });
  return state ? toClientJson(state) : null;
}

export async function getMyCoherenceVotesForCoherenceIdsAction(
  data: { coherenceIds: number[] },
  { authToken }: { authToken?: string },
) {
  return getMyCoherenceVotesForCoherenceIds(data, {
    db: getDb({ authToken: authToken ?? undefined }),
  });
}
