import { inArray } from 'drizzle-orm';
import { documents } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';

export type QuestProposalDocument = {
  id: number;
  spaceId: number | null;
  slug: string | null;
  web3ProposalId: number | null;
};

/**
 * The documents that quests point to, with the space each belongs to, so a link to a
 * document of another space (or to one that is gone) can be dropped. Read only; the ids come
 * from quest rows of the one space the caller already passed the access policy for.
 */
export async function selectQuestProposalDocuments(
  { db }: DbConfig,
  documentIds: number[],
): Promise<Map<number, QuestProposalDocument>> {
  const out = new Map<number, QuestProposalDocument>();
  if (documentIds.length === 0) return out;
  const rows = await db
    .select({
      id: documents.id,
      spaceId: documents.spaceId,
      slug: documents.slug,
      web3ProposalId: documents.web3ProposalId,
    })
    .from(documents)
    .where(inArray(documents.id, documentIds));
  for (const row of rows) out.set(row.id, row);
  return out;
}
