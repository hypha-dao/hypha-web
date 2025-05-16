import { CreatePayForExpensesForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@core/space/server';
import { getDhoPathGovernance } from '../../../../@tab/governance/constants';
import { Plugin } from '../plugins';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreatePayForExpensesPage({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

  return (
    <SidePanel>
      <CreatePayForExpensesForm
        successfulUrl={getDhoPathGovernance(lang as Locale, id)}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
        plugin={<Plugin name="pay-for-expenses" spaceSlug={spaceSlug} />}
      />
    </SidePanel>
  );
}
