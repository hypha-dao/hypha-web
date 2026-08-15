import {
  CreateIntelligenceForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; tab: string }>;
};

export default async function NewIntelligencePage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const successfulUrl = `/${lang}/dho/${id}/memory`;

  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard
        spaceSlug={id}
        spaceId={spaceFromDb.web3SpaceId ?? undefined}
      >
        <CreateIntelligenceForm
          spaceSlug={id}
          successfulUrl={successfulUrl}
          closeUrl={successfulUrl}
          backUrl={successfulUrl}
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
