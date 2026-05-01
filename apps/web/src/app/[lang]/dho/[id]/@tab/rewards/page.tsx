import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import {
  SpacePendingRewardsSection,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getTranslations } from 'next-intl/server';
import { TabScreenTitle } from '../_components/tab-screen-title';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function RewardsPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;
  const tProfile = await getTranslations('Profile');
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  return (
    <SpaceTabAccessWrapper
      spaceId={spaceFromDb?.web3SpaceId as number}
      spaceSlug={id}
    >
      <div className="flex flex-col gap-6 py-4">
        <TabScreenTitle title="Rewards" />
        <div className="flex w-full justify-end">
          <Link href={`/${lang}/dho/${id}/agreements/create/buy-hypha-tokens`}>
            <Button>{tProfile('buyHypha')}</Button>
          </Link>
        </div>
        <SpacePendingRewardsSection
          web3SpaceId={spaceFromDb?.web3SpaceId as number}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
