import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { getDhoPathTreasury } from './constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getTranslations } from 'next-intl/server';
import { TabScreenTitle } from '../_components/tab-screen-title';
import { TreasuryTabs } from '../../_components/treasury-tabs';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;
  const tCommon = await getTranslations('Common');

  const { lang, id } = params;

  const basePath = getDhoPathTreasury(lang, id);
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb?.web3SpaceId as number}
      spaceSlug={id}
    >
      <div className="flex flex-col gap-4 py-4">
        <TabScreenTitle title={tCommon('Treasury')} />
        <TreasuryTabs
          basePath={basePath}
          spaceSlug={id}
          web3SpaceId={spaceFromDb?.web3SpaceId as number}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
