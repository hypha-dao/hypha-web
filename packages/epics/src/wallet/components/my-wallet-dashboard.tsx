'use client';

import * as React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe, usePendingRewards } from '@hypha-platform/core/client';
import { usePayoutAccounts } from '../../banking/hooks';
import { PendingRewardsSection } from '../../treasury/components/assets/pending-rewards-section';
import { UserAssetsSection } from '../../treasury/components/assets/user-assets-section';
import { UserTransactionsSection } from '../../treasury/components/requests/user-transactions-section';
import { useUserAssets, useUserTransfers } from '../../treasury/hooks';
import { ProfileBankingSection } from '../../banking/components/profile-banking-section';
import { SpaceAccessDenied } from '../../spaces/components/space-access-denied';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { WalletActionsToolbar } from './wallet-actions-toolbar';

const HYPHA_TOKEN_ADDRESS = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
const MIN_REWARD_CLAIM_VALUE = 0.01;

type MyWalletDashboardProps = {
  lang: string;
};

type WalletTabLabelProps = {
  label: string;
  count: number;
};

function WalletTabLabel({ label, count }: WalletTabLabelProps) {
  const format = useFormatter();

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">
        ({format.number(count)})
      </span>
    </span>
  );
}

export function MyWalletDashboard({ lang }: MyWalletDashboardProps) {
  const tMyWallet = useTranslations('MyWallet');
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading } = useMe();
  const [activeTab, setActiveTab] = React.useState('wallet');

  const basePath = `/${lang}/my-wallet`;
  const personSlug = person?.slug;
  const bankingBasePath = personSlug
    ? `/api/v1/people/${personSlug}/banking`
    : undefined;

  const { assets } = useUserAssets({
    personSlug,
  });
  const { transfers } = useUserTransfers({
    personSlug,
  });
  const { accounts: payoutAccounts } = usePayoutAccounts({
    basePath: bankingBasePath,
    enabled: isAuthenticated && Boolean(personSlug),
  });

  const hyphaTokenAddress =
    assets.find(
      (asset) =>
        asset.symbol === 'HYPHA' ||
        asset.address?.toLowerCase() === HYPHA_TOKEN_ADDRESS.toLowerCase(),
    )?.address ?? HYPHA_TOKEN_ADDRESS;

  const { pendingRewards } = usePendingRewards({
    user: person?.address as `0x${string}` | undefined,
    hyphaTokenAddress: hyphaTokenAddress as `0x${string}`,
  });

  const walletCount = assets.filter((asset) => asset.value > 0).length;
  const transactionCount = transfers.length;
  const bankingCount = payoutAccounts.length;
  const parsedRewardValue =
    pendingRewards !== undefined ? Number(pendingRewards) / 1e18 : 0;
  const rewardsCount = parsedRewardValue >= MIN_REWARD_CLAIM_VALUE ? 1 : 0;

  if (!isAuthenticated) {
    return <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />;
  }

  if (isLoading || !personSlug) {
    return (
      <p className="text-center text-muted-foreground">
        {tMyWallet('loading')}
      </p>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex w-full min-w-0 flex-col gap-4"
    >
      <div className="@container/wallet-toolbar w-full min-w-0">
        <div className="flex w-full min-w-0 flex-col gap-2 @[52rem]:flex-row @[52rem]:items-center @[52rem]:justify-between @[52rem]:gap-3">
          <div className="w-full min-w-0 overflow-x-auto">
            <TabsList triggerVariant="switch" className="w-max max-w-none">
              <TabsTrigger value="wallet" variant="switch">
                <WalletTabLabel
                  label={tMyWallet('tabs.wallet')}
                  count={walletCount}
                />
              </TabsTrigger>
              <TabsTrigger value="banking" variant="switch">
                <WalletTabLabel
                  label={tMyWallet('tabs.banking')}
                  count={bankingCount}
                />
              </TabsTrigger>
              <TabsTrigger value="transactions" variant="switch">
                <WalletTabLabel
                  label={tMyWallet('tabs.transactions')}
                  count={transactionCount}
                />
              </TabsTrigger>
              <TabsTrigger value="rewards" variant="switch">
                <WalletTabLabel
                  label={tMyWallet('tabs.rewards')}
                  count={rewardsCount}
                />
              </TabsTrigger>
            </TabsList>
          </div>
          <WalletActionsToolbar
            basePath={basePath}
            className="w-full @[52rem]:w-auto"
          />
        </div>
      </div>

      <TabsContent value="wallet" className="mt-0">
        <UserAssetsSection
          personSlug={personSlug}
          basePath={basePath}
          isMyProfile
          showActionButtons={false}
        />
      </TabsContent>

      <TabsContent value="banking" className="mt-0">
        <ProfileBankingSection personSlug={personSlug} isMyProfile />
      </TabsContent>

      <TabsContent value="transactions" className="mt-0">
        <UserTransactionsSection personSlug={personSlug} />
      </TabsContent>

      <TabsContent value="rewards" className="mt-0">
        <PendingRewardsSection person={person} isMyProfile />
      </TabsContent>
    </Tabs>
  );
}
