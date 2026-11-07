import { and, eq, isNull } from 'drizzle-orm';
import { spaceQuests } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';

/**
 * Delete a still-proposed, never-accepted Quest when its Agreements document
 * is withdrawn. Must run before the document row is deleted (`ON DELETE SET NULL`).
 */
export async function deleteUnacceptedProposedQuestByDocumentId(
  { documentId }: { documentId: number },
  { db }: DbConfig,
): Promise<number> {
  const removed = await db
    .delete(spaceQuests)
    .where(
      and(
        eq(spaceQuests.proposalDocumentId, documentId),
        eq(spaceQuests.status, 'proposed'),
        isNull(spaceQuests.acceptedAt),
      ),
    )
    .returning();
  return removed.length;
}
