import { ConnectedCreateSignalForm } from '@web/components/connected-create-signal-form';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import {
  COHERENCE_SIGNAL_TYPES,
  COHERENCE_TAGS,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
  searchParams: Promise<{
    boardTag?: string | string[];
    type?: string;
    title?: string;
  }>;
};

export default async function NewSignalPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id } = await params;
  const { boardTag, type, title } = await searchParams;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const boardTagsRaw = Array.isArray(boardTag)
    ? boardTag
    : boardTag
    ? [boardTag]
    : [];
  const canonicalTags = new Set(COHERENCE_TAGS as readonly string[]);
  const inheritedBoardTags = [...new Set(boardTagsRaw.map((tag) => tag.trim()))]
    .filter(Boolean)
    .filter((tag) => canonicalTags.has(tag));
  const signalType = (COHERENCE_SIGNAL_TYPES as readonly string[]).includes(
    type ?? '',
  )
    ? (type as (typeof COHERENCE_SIGNAL_TYPES)[number])
    : undefined;
  const signalTitle =
    typeof title === 'string' ? title.trim().slice(0, 120) : '';

  const successfulUrl = getDhoPathCoherence(lang, id);
  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard
        spaceSlug={id}
        spaceId={spaceFromDb.web3SpaceId ?? undefined}
      >
        <ConnectedCreateSignalForm
          successfulUrl={successfulUrl}
          closeUrl={successfulUrl}
          backUrl={successfulUrl}
          spaceId={spaceFromDb.id}
          initialValues={
            inheritedBoardTags.length > 0 || signalType || signalTitle
              ? {
                  ...(inheritedBoardTags.length > 0
                    ? { tags: inheritedBoardTags }
                    : {}),
                  ...(signalType ? { type: signalType } : {}),
                  ...(signalTitle ? { title: signalTitle } : {}),
                }
              : undefined
          }
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
