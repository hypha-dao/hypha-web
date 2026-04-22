'use server';

import { getDb } from '../../common/server/get-db';
import { findCoherenceBySlug } from './queries';
import { normalizeCoherence } from './web3/normalize-coherence';
import { assertCoherenceCreatorBySlug } from './ensure-signal-creator';
import type { Coherence } from '../types';

export async function fetchCoherenceForEditAction(
  slug: string,
  { authToken }: { authToken: string },
): Promise<Coherence | null> {
  if (!slug) return null;
  const db = getDb({ authToken });
  try {
    await assertCoherenceCreatorBySlug(slug, { db });
  } catch {
    return null;
  }
  const row = await findCoherenceBySlug({ slug }, { db });
  if (!row) return null;
  return normalizeCoherence(row);
}
