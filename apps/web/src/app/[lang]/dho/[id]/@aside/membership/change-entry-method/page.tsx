import { ChangeEntryMethodForm, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathGovernance } from '../../../@tab/governance/constants';
import { notFound } from 'next/navigation';
import { createSpaceService } from '@core/space/server';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function ChangeEntryMethodPage({ params }: PageProps) {
  const { id, lang } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  if (!spaceFromDb) notFound();
  const { id: spaceId, web3SpaceId, slug: spaceSlug } = spaceFromDb;

  return (
    <SidePanel>
      <ChangeEntryMethodForm
        successfulUrl={getDhoPathGovernance(lang as Locale, spaceSlug)}
        spaceId={spaceId}
        web3SpaceId={web3SpaceId}
      />
    </SidePanel>
  );
}
