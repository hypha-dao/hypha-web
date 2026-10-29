import { inArray } from 'drizzle-orm';
import { documents } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import {
  attachProposalStatusToDocument,
  fetchProposalOutcomeSetsForSpace,
} from '../../governance/server/resolve-document-proposal-status';
import type { Document } from '../../governance/types';
import { listSpaceContextSections } from './queries';
import {
  ratifySpaceContextSectionsByDocumentId,
  revertSpaceContextSectionsByDocumentId,
} from './mutations';
import type { SpaceContextOverview } from '../types';

/**
 * Align Context card status with the linked Agreements proposal on-chain
 * outcome. Does not invent a second governance path.
 */
export async function syncSpaceContextProposalStatuses(
  { spaceSlug }: { spaceSlug: string },
  { db }: DbConfig,
): Promise<SpaceContextOverview | null> {
  const overview = await listSpaceContextSections({ spaceSlug }, { db });
  if (!overview) return null;

  const proposed = overview.sections.filter(
    (section) => section.status === 'proposed' && section.proposalDocumentId,
  );
  if (proposed.length === 0) return overview;

  const documentIds = [
    ...new Set(
      proposed
        .map((section) => section.proposalDocumentId)
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
    const withdrawn =
      doc.web3ProposalId != null &&
      outcomes?.withdrawn.has(Number(doc.web3ProposalId));
    if (withStatus.status === 'accepted') {
      await ratifySpaceContextSectionsByDocumentId(
        { documentId: doc.id },
        { db },
      );
    } else if (withStatus.status === 'rejected' || withdrawn) {
      await revertSpaceContextSectionsByDocumentId(
        { documentId: doc.id },
        { db },
      );
    }
  }

  return listSpaceContextSections({ spaceSlug }, { db });
}
