import { createSpaceService } from '@core/space/server';
import { CreateProposalChangeEntryMethodForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound } from 'next/navigation';
import { Plugin } from '../plugins';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateChangeEntryMethodPage({
  params,
}: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

  return (
    <SidePanel>
      <CreateProposalChangeEntryMethodForm
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        successfulUrl={getDhoPathGovernance(lang as Locale, id)}
        plugin={<Plugin spaceSlug={spaceSlug} name="change-entry-method" />}
      />
    </SidePanel>
  );
}
