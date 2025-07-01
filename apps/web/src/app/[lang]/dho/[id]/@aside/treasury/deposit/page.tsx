import { DepositFunds, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { createSpaceService } from '@hypha-platform/core/server';
import { getDhoPathTreasury } from '../../../@tab/treasury/constants';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Treasury({ params }: PageProps) {
  const { lang, id } = await params;

  const spaceService = createSpaceService();

  const spaceFromDb = await spaceService.getBySlug({ slug: id });

  const spaceId = spaceFromDb.web3SpaceId;

  const closeUrl = getDhoPathTreasury(lang as Locale, id);

  return (
    <SidePanel>
      <DepositFunds
        closeUrl={closeUrl}
        backUrl={`${closeUrl}${PATH_SELECT_CREATE_ACTION}`}
        spaceId={spaceId}
      />
    </SidePanel>
  );
}
