import {
  CreateWhitelistEnergySettlementForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateWhitelistEnergySettlementProposalPage({
  params,
}: PageProps) {
  const { lang, id } = await params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const successfulUrl = getDhoPathAgreements(lang as Locale, id);
  const backUrl = `${successfulUrl}${PATH_SELECT_CREATE_ACTION}`;

  return (
    <ProposalOverlayShell>
      <CreateWhitelistEnergySettlementForm
        successfulUrl={successfulUrl}
        backUrl={backUrl}
        spaceId={spaceFromDb.id}
        web3SpaceId={spaceFromDb.web3SpaceId}
      />
    </ProposalOverlayShell>
  );
}
