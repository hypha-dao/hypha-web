import { DepositFunds, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@hypha-platform/core/server';
import { getDhoPathTreasury } from '../../../@tab/treasury/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Treasury({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  const spaceId = spaceFromDb.web3SpaceId;

  return (
    <SidePanel>
      <DepositFunds closeUrl={getDhoPathTreasury(lang, id)} spaceId={spaceId} />
    </SidePanel>
  );
}
