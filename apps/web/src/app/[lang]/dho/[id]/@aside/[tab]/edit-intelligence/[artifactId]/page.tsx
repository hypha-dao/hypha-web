import {
  CreateIntelligenceForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{
    lang: Locale;
    id: string;
    tab: string;
    artifactId: string;
  }>;
};

export default async function EditIntelligencePage({ params }: PageProps) {
  const { lang, id, artifactId } = await params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const successfulUrl = `/${lang}/dho/${id}/memory`;

  return (
    <ProposalOverlayShell>
      <CreateIntelligenceForm
        mode="edit"
        spaceSlug={id}
        artifactId={artifactId}
        successfulUrl={successfulUrl}
        closeUrl={successfulUrl}
        backUrl={successfulUrl}
      />
    </ProposalOverlayShell>
  );
}
