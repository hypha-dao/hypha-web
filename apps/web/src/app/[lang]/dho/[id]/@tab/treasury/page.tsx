import { Locale } from '@hypha-platform/i18n';
import {
  AssetsSection,
  TransactionsSection,
  VaultsSection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { getDhoPathTreasury } from './constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getTranslations } from 'next-intl/server';
import { TabScreenTitle } from '../_components/tab-screen-title';

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
      <div className="flex flex-col gap-6 py-4">
        <TabScreenTitle title={tCommon('Treasury')} />
        <VaultsSection />
        <AssetsSection
          basePath={basePath}
          web3SpaceId={spaceFromDb?.web3SpaceId as number}
        />
        <TransactionsSection spaceSlug={id} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
