'use server';

import { getDb } from '../../common/server/get-db';
import { CreateCoherenceInput, UpdateCoherenceBySlugInput } from '../types';
import { db } from '@hypha-platform/storage-postgres';
import {
  createCoherence,
  deleteCoherenceBySlug,
  updateCoherenceBySlug,
} from './mutations';
import { assertCoherenceCreatorBySlug } from './ensure-signal-creator';

export async function createCoherenceAction(
  data: CreateCoherenceInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create coherence');
  return createCoherence({ ...data }, { db });
}

export async function updateCoherenceBySlugAction(
  data: UpdateCoherenceBySlugInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to update coherence');
  const authDb = getDb({ authToken });
  await assertCoherenceCreatorBySlug(data.slug, { db: authDb });
  return updateCoherenceBySlug(data, { db: authDb });
}

export async function deleteCoherenceBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to delete coherence');
  const authDb = getDb({ authToken });
  await assertCoherenceCreatorBySlug(data.slug, { db: authDb });
  return deleteCoherenceBySlug(data, { db: authDb });
}
