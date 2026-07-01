import { coherences } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';
import type { DbConfig } from '../../server';

export async function assertCoherenceInSpace(
  {
    coherenceId,
    spaceId,
  }: {
    coherenceId: number | null | undefined;
    spaceId: number;
  },
  { db }: DbConfig,
) {
  if (coherenceId == null) return;

  const [row] = await db
    .select({ spaceId: coherences.spaceId })
    .from(coherences)
    .where(eq(coherences.id, coherenceId))
    .limit(1);

  if (!row?.spaceId || row.spaceId !== spaceId) {
    throw new Error('Linked signal must belong to this space');
  }
}
