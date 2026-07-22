import {
  CreateEnableEnergyCommunityForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  findEnergyCommunityBySpaceId,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { getDhoPathAgreements } from '../../../../@tab/agreements/constants';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { db } from '@hypha-platform/storage-postgres';
import { fetchSpaceMemberRecipients } from '@web/utils/fetch-space-member-recipients';
import { notFound, redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateEnableEnergyCommunityProposalPage({
  params,
}: PageProps) {
  const { lang, id } = await params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  if (!spaceFromDb) notFound();

  const successfulUrl = getDhoPathAgreements(lang as Locale, id);
  const backUrl = `${successfulUrl}${PATH_SELECT_SETTINGS_ACTION}`;
  const energyMapping = await findEnergyCommunityBySpaceId(spaceFromDb.id, {
    db,
  });

  if (energyMapping) {
    redirect(backUrl);
  }

  const { members, spaces } = await fetchSpaceMemberRecipients(id);

  return (
    <ProposalOverlayShell>
      <CreateEnableEnergyCommunityForm
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
