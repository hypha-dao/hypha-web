import {
  SidePanel,
  CreateProposalChangeVotingMethodForm,
  ChangeVotingMethodPlugin,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { notFound } from 'next/navigation';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateChangeVotingMethodPage({
  params,
}: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId } = spaceFromDb;

  return (
    <SidePanel>
      <CreateProposalChangeVotingMethodForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={getDhoPathGovernance(lang as Locale, id)}
        plugin={<ChangeVotingMethodPlugin />}
      />
    </SidePanel>
  );
}
