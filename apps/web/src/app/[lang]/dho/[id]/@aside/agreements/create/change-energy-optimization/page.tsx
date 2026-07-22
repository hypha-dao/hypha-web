import {
  CreateChangeEnergyOptimizationForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { fetchSpaceMemberRecipients } from '@web/utils/fetch-space-member-recipients';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateChangeEnergyOptimizationProposalPage({
  params,
}: PageProps) {
  const { lang, id } = await params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const successfulUrl = getDhoPathAgreements(lang as Locale, id);
  const backUrl = `${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`;

  const { members, spaces } = await fetchSpaceMemberRecipients(id);

  return (
    <ProposalOverlayShell>
      <CreateChangeEnergyOptimizationForm
        successfulUrl={successfulUrl}
        backUrl={backUrl}
        spaceId={spaceFromDb.id}
        web3SpaceId={spaceFromDb.web3SpaceId}
        members={members}
        spaces={spaces}
      />
    </ProposalOverlayShell>
  );
}
