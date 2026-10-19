'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import { PendingRewardsSection } from '../../treasury/components/assets/pending-rewards-section';
import { UserAssetsSection } from '../../treasury/components/assets/user-assets-section';
import { UserTransactionsSection } from '../../treasury/components/requests/user-transactions-section';
import { ProfileBankingSection } from '../../banking/components/profile-banking-section';
import { SpaceAccessDenied } from '../../spaces/components/space-access-denied';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';
import { SpaceAccentLoader } from '../../common/space-accent-loader';
import { WalletShortcutCards } from './wallet-shortcut-cards';
import { useTranslations } from 'next-intl';
import type { WalletSectionNavKey } from './wallet-section-nav';

type MyWalletDashboardProps = {
  lang: string;
  /** Left-menu section. `wallet` is the action shortcuts and the default screen. */
  section?: WalletSectionNavKey;
};

export function MyWalletDashboard({
  lang,
  section = 'wallet',
}: MyWalletDashboardProps) {
  const tMyWallet = useTranslations('MyWallet');
  const { isAuthenticated } = useAuthentication();
  const { person, isLoading } = useMe();
  const basePath = `/${lang}/my-wallet`;
  const personSlug = person?.slug;

  if (!isAuthenticated) {
    return <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />;
  }

  // Only block the page on the initial profile load. Background revalidation
  // (JWT refresh, focus) must not tear the wallet down into a full-page spinner.
  if (!personSlug && isLoading) {
    return (
      <div className="flex w-full min-h-[280px] items-center justify-center py-16">
        <SpaceAccentLoader label={tMyWallet('loading')} />
      </div>
    );
  }

  if (!personSlug) {
    return <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />;
  }

  if (section === 'wallet') {
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <WalletShortcutCards basePath={basePath} />
      </div>
    );
  }

  if (section === 'assets') {
    return (
      <UserAssetsSection
        personSlug={personSlug}
        basePath={basePath}
        isMyProfile
        showActionButtons={false}
      />
    );
  }

  if (section === 'banking') {
    return <ProfileBankingSection personSlug={personSlug} isMyProfile />;
  }

  if (section === 'transactions') {
    return <UserTransactionsSection personSlug={personSlug} />;
  }

  return <PendingRewardsSection person={person} isMyProfile />;
}
