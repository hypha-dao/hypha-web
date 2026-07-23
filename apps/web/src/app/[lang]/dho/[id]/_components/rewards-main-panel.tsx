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
  const tTreasury = useTranslations('TreasuryTab');
  const [rewardCount, setRewardCount] = useState(0);

  return (
    <div className="flex flex-col gap-5 py-4">
      <TabScreenTitle
        title={tTreasury('rewardsSection.title')}
        count={rewardCount}
        lang={lang}
      />
      <SpacePendingRewardsSection
        web3SpaceId={web3SpaceId}
        compactHeader
        onVisibleRewardCountChange={setRewardCount}
        toolbarActions={
          <Button asChild>
            <Link
              href={`/${lang}/dho/${spaceSlug}/agreements/create/buy-hypha-tokens`}
            >
              {tProfile('buyHypha')}
            </Link>
          </Button>
        }
      />
    </div>
  );
}
