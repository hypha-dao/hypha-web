import { EditSignalForm, ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import {
  findSpaceBySlug,
  getCoherenceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; signalSlug: string }>;
};

export default async function EditSignalCoherenceAsidePage({
  params,
}: PageProps) {
  const { lang, id, signalSlug } = await params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const coherence = await getCoherenceBySlug({ slug: signalSlug });
  if (!coherence || coherence.spaceId !== spaceFromDb.id) {
    notFound();
  }

  const successfulUrl = getDhoPathCoherence(lang, id);
  return (
    <ProposalOverlayShell>
      <EditSignalForm
        coherence={coherence}
        successfulUrl={successfulUrl}
        closeUrl={successfulUrl}
        backUrl={successfulUrl}
      />
    </ProposalOverlayShell>
  );
}
