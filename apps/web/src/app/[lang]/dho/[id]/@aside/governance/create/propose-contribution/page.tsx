import {
  CreateProposeAContributionForm,
  SidePanel,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { getDhoPathGovernance, selectCreateActionPath } from '../../../../@tab/governance/constants';
import { Plugin } from '../plugins';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateProposeAContributionPage({
  params,
}: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;
  const successfulUrl = getDhoPathGovernance(lang as Locale, id);

  return (
    <SidePanel>
      <CreateProposeAContributionForm
        successfulUrl={successfulUrl}
        backUrl={`${successfulUrl}${selectCreateActionPath}`}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        plugin={<Plugin name="propose-contribution" spaceSlug={spaceSlug} />}
      />
    </SidePanel>
  );
}
