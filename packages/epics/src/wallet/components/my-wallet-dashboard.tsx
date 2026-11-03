'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import { PendingRewardsSection } from '../../treasury/components/assets/pending-rewards-section';
import { UserAssetsSection } from '../../treasury/components/assets/user-assets-section';
import { UserTransactionsSection } from '../../treasury/components/requests/user-transactions-section';
import { ProfileBankingSection } from '../../banking/components/profile-banking-section';
import { SpaceAccessDenied } from '../../spaces/components/space-access-denied';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';
import { AssetCard } from '../../treasury/components/assets/asset-card';
import { WalletShortcutCards } from './wallet-shortcut-cards';
import type { WalletSectionNavKey } from './wallet-section-nav';

type MyWalletDashboardProps = {
  lang: string;
  /** Left-menu section. `wallet` is actions, assets, and transactions together. */
  section?: WalletSectionNavKey;
  /** Raw `token=` query. Invalid values stay scoped — never drop the filter. */
  tokenFilter?: string;
};

export function MyWalletDashboard({
  lang,
  section = 'wallet',
  tokenFilter,
}: MyWalletDashboardProps) {
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading } = useMe();
  const basePath = `/${lang}/my-wallet`;
  const personSlug = person?.slug;

  if (!isAuthenticated) {
    return <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />;
  }

  if (!personSlug && !isLoading) {
    return <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />;
  }

  // Profile and balances resolve after the shell. Keep the shortcut row and
  // asset-shaped placeholders on screen instead of a blank spinner.
  if (!personSlug) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-5">
        {section === 'wallet' ? (
          <WalletShortcutCards basePath={basePath} />
        ) : null}
        <div className="grid w-full grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AssetCard isLoading />
          <AssetCard isLoading />
          <AssetCard isLoading />
        </div>
      </div>
    );
  }

  if (section === 'banking') {
    return <ProfileBankingSection personSlug={personSlug} isMyProfile />;
  }

  if (section === 'rewards') {
    return <PendingRewardsSection person={person} isMyProfile />;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <WalletShortcutCards basePath={basePath} />
      <UserAssetsSection
        personSlug={personSlug}
        basePath={basePath}
        isMyProfile
        showActionButtons={false}
      />
      <UserTransactionsSection
        personSlug={personSlug}
        tokenFilter={tokenFilter}
      />
    </div>
  );
}
