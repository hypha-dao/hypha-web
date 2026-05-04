import {
  CreateAgreementForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function NewMemoryPage({ params }: PageProps) {
  const { lang, id } = await params;
  const tCoherence = await getTranslations('CoherenceTab');

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const successfulUrl = `/${lang}/dho/${id}/memory`;

  return (
    <ProposalOverlayShell>
      <CreateAgreementForm
        successfulUrl={successfulUrl}
        backUrl={successfulUrl}
        closeUrl={successfulUrl}
        spaceId={spaceFromDb.id}
        web3SpaceId={spaceFromDb.web3SpaceId}
        label={tCoherence('newMemory')}
        stickyHeaderTitle={tCoherence('newMemory')}
      />
    </ProposalOverlayShell>
  );
}
