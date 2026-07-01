import { ConnectedCreateSignalForm } from '@web/components/connected-create-signal-form';
import { ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import {
  COHERENCE_SIGNAL_TYPES,
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
  if (!(COHERENCE_SIGNAL_TYPES as readonly string[]).includes(signal.type)) {
    notFound();
  }

  const successfulUrl = getDhoPathCoherence(lang, id);
  const signalType = signal.type as (typeof COHERENCE_SIGNAL_TYPES)[number];

  return (
    <ProposalOverlayShell>
      <ConnectedCreateSignalForm
        mode="edit"
        signalId={signal.id}
        signalSlug={signal.slug}
        signalRoomId={signal.roomId}
        initialValues={{
          title: signal.title,
          description: signal.description,
          creatorId: signal.creatorId,
          spaceId: spaceFromDb.id,
          archived: signal.archived,
          type: signalType,
          priority: signal.priority,
          tags: signal.tags,
          dueAt: signal.dueAt ?? null,
          progressStatus: signal.progressStatus ?? undefined,
          board: signal.board ?? null,
        }}
        successfulUrl={successfulUrl}
        closeUrl={successfulUrl}
        backUrl={successfulUrl}
        spaceId={spaceFromDb.id}
      />
    </ProposalOverlayShell>
  );
}
