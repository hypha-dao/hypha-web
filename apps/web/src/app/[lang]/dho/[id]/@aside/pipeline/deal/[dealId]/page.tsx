import { ProposalOverlayShell } from '@hypha-platform/epics';
import { ConnectedSpaceMemberAsideGuard } from '@web/components/connected-space-member-aside-guard';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { Locale } from '@hypha-platform/i18n';
import { db } from '@hypha-platform/storage-postgres';
import { notFound, redirect } from 'next/navigation';
import { getDhoPathOverview } from '../../../../@tab/overview/constants';
import { getDhoPathPipeline } from '../../../../@tab/pipeline/constants';
import { PipelineDealAsideClient } from './pipeline-deal-aside-client';

type PageProps = {
  params: Promise<{ lang: Locale; id: string; dealId: string }>;
};

export default async function PipelineDealAsidePage({ params }: PageProps) {
  const { lang, id, dealId: dealIdRaw } = await params;
  const dealId = Number.parseInt(dealIdRaw, 10);
  if (!Number.isInteger(dealId) || dealId <= 0) {
    notFound();
  }

  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();
  if (!spaceFromDb.pipelineEnabled) {
    redirect(getDhoPathOverview(lang, id));
  }

  const closeUrl = getDhoPathPipeline(lang, id);

  return (
    <ProposalOverlayShell>
      <ConnectedSpaceMemberAsideGuard
        spaceSlug={id}
        spaceId={spaceFromDb.web3SpaceId ?? undefined}
      >
        <PipelineDealAsideClient
          spaceSlug={id}
          dealId={dealId}
          closeUrl={closeUrl}
        />
      </ConnectedSpaceMemberAsideGuard>
    </ProposalOverlayShell>
  );
}
