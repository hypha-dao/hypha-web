import { CreateSignalForm, ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import {
  findSpaceBySlug,
  getCoherenceBySlug,
} from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{
    lang: Locale;
    id: string;
    tab: string;
    signalSlug: string;
  }>;
};

export default async function EditSignalPage({ params }: PageProps) {
  const { lang, id, signalSlug } = await params;

  const [spaceFromDb, signal] = await Promise.all([
    findSpaceBySlug({ slug: id }, { db }),
    getCoherenceBySlug({ slug: signalSlug }),
  ]);

  if (
    !spaceFromDb ||
    !signal ||
    signal.spaceId !== spaceFromDb.id ||
    !signal.slug
  ) {
    notFound();
  }

  const successfulUrl = getDhoPathCoherence(lang, id);

  return (
    <ProposalOverlayShell>
      <CreateSignalForm
        mode="edit"
        signalSlug={signal.slug}
        initialValues={{
          title: signal.title,
          description: signal.description,
          creatorId: signal.creatorId,
          spaceId: signal.spaceId,
          archived: signal.archived,
          type: signal.type,
          priority: signal.priority,
          tags: signal.tags,
        }}
        successfulUrl={successfulUrl}
        closeUrl={successfulUrl}
        backUrl={successfulUrl}
        spaceId={spaceFromDb.id}
      />
    </ProposalOverlayShell>
  );
}
