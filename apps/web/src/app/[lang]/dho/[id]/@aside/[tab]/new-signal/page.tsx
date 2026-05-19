import { CreateSignalForm, ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import { COHERENCE_TAGS, findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
  searchParams: Promise<{ boardTag?: string | string[] }>;
};

export default async function NewSignalPage({
  params,
  searchParams,
}: PageProps) {
  const { lang, id } = await params;
  const { boardTag } = await searchParams;

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

  const successfulUrl = getDhoPathCoherence(lang, id);
  return (
    <ProposalOverlayShell>
      <CreateSignalForm
        successfulUrl={successfulUrl}
        closeUrl={successfulUrl}
        backUrl={successfulUrl}
        spaceId={spaceFromDb.id}
        initialValues={
          inheritedBoardTags.length > 0 ? { tags: inheritedBoardTags } : undefined
        }
      />
    </ProposalOverlayShell>
  );
}
