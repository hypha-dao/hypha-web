'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SpacePendingRewardsSection } from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { TabScreenTitle } from '../@tab/_components/tab-screen-title';

type RewardsMainPanelProps = {
  lang: string;
  spaceSlug: string;
  web3SpaceId: number;
};

export function RewardsMainPanel({
  lang,
  spaceSlug,
  web3SpaceId,
}: RewardsMainPanelProps) {
  const tProfile = useTranslations('Profile');
  const [rewardCount, setRewardCount] = useState(0);

  return (
    <div className="flex flex-col gap-4 py-4">
      <TabScreenTitle title="Rewards" count={rewardCount} />
      <SpacePendingRewardsSection
        web3SpaceId={web3SpaceId}
        onVisibleRewardCountChange={setRewardCount}
        toolbarActions={
          <Link
            href={`/${lang}/dho/${spaceSlug}/agreements/create/buy-hypha-tokens`}
          >
            <Button>{tProfile('buyHypha')}</Button>
          </Link>
        }
      />
    </div>
  );
}
