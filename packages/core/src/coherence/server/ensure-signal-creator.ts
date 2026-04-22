import type { DatabaseInstance } from '../../server';
import { findCoherenceBySlug } from './queries';
import { findSelf } from '../../people/server/queries';

export async function assertCoherenceCreatorBySlug(
  slug: string,
  { db }: { db: DatabaseInstance },
): Promise<void> {
  const viewer = await findSelf({ db });
  if (!viewer?.id) {
    throw new Error('Unauthorized');
  }
  const row = await findCoherenceBySlug({ slug }, { db });
  if (!row) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (row.creatorId !== viewer.id) {
    throw new Error('Only the signal creator can modify this coherence');
  }
}
