import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { getDhoPathTreasury } from './constants';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { TreasuryTabs } from '../../_components/treasury-tabs';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = getDhoPathTreasury(lang, id);
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb?.web3SpaceId as number}
      spaceSlug={id}
    >
      <TreasuryTabs
        basePath={basePath}
        spaceSlug={id}
        web3SpaceId={spaceFromDb?.web3SpaceId as number}
      />
    </SpaceTabAccessWrapper>
  );
}
