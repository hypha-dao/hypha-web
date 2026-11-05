import { inArray } from 'drizzle-orm';
import { documents } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import {
  attachProposalStatusToDocument,
  fetchProposalOutcomeSetsForSpace,
} from '../../governance/server/resolve-document-proposal-status';
import type { Document } from '../../governance/types';
import type { SpaceQuestsOverview } from '../types';
import { listSpaceQuests } from './queries';
import { activateSpaceQuestByDocumentId } from './mutations';

/**
 * Sync proposed Quests with on-chain Agreements proposal outcomes.
 * When a Quest proposal passes on-chain, transitions the Quest to Active
 * and opens its Quest channel in Messages.
 */
export async function syncSpaceQuestProposalStatuses(
  { spaceSlug }: { spaceSlug: string },
  { db }: DbConfig,
): Promise<SpaceQuestsOverview | null> {
  const overview = await listSpaceQuests({ spaceSlug }, { db });
  if (!overview) return null;

  let changed = false;

  // Activation commits before the Matrix room exists; retry rooms that failed.
  const missingRoom = overview.quests.flatMap((q) =>
    q.status === 'active' && q.proposalDocumentId != null && !q.chatRoomId
      ? [q.proposalDocumentId]
      : [],
  );
  for (const documentId of missingRoom) {
    const count = await activateSpaceQuestByDocumentId({ documentId }, { db });
    if (count > 0) changed = true;
  }

  const proposed = overview.quests.filter(
    (q) => q.status === 'proposed' && q.proposalDocumentId != null,
  );
  if (proposed.length === 0) {
    return changed ? listSpaceQuests({ spaceSlug }, { db }) : overview;
  }

  const documentIds = [
    ...new Set(
      proposed
        .map((q) => q.proposalDocumentId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];
  const docs = await db
    .select()
    .from(documents)
    .where(inArray(documents.id, documentIds));

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  const outcomes =
    space?.web3SpaceId != null
      ? await fetchProposalOutcomeSetsForSpace(space.web3SpaceId, {
          blockTag: 'latest',
        })
      : null;

  for (const doc of docs) {
    const withStatus = attachProposalStatusToDocument(
      doc as Document,
      outcomes,
    );
    if (withStatus.status === 'accepted') {
      const count = await activateSpaceQuestByDocumentId(
        { documentId: doc.id },
        { db },
      );
      if (count > 0) changed = true;
    }
  }

  return changed ? listSpaceQuests({ spaceSlug }, { db }) : overview;
}
