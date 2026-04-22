import { CreateSignalForm, ProposalOverlayShell } from '@hypha-platform/epics';
import { getDhoPathCoherence } from '../../../@tab/coherence/constants';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
};

export default async function NewSignalPage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) notFound();

  const successfulUrl = getDhoPathCoherence(lang, id);
  return (
    <ProposalOverlayShell>
      <CreateSignalForm
        successfulUrl={successfulUrl}
        closeUrl={successfulUrl}
        backUrl={successfulUrl}
        spaceId={spaceFromDb.id}
      />
    </ProposalOverlayShell>
  );
}
