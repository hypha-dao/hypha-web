import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { MemberPageShell } from '../../_components/member-page-shell';
import { MemberScreenTitle } from '../../_components/member-screen-title';

export type WalletPageTitleKey =
  | 'allYourAssets'
  | 'bankTransfers'
  | 'allYourRewards';

export async function WalletPageFrame({
  children,
  titleKey = 'allYourAssets',
}: {
  lang: Locale;
  children: ReactNode;
  titleKey?: WalletPageTitleKey;
}) {
  const t = await getTranslations('MyWallet');
  const memberTitle =
    titleKey === 'bankTransfers'
      ? t('tabs.banking')
      : titleKey === 'allYourRewards'
      ? t('tabs.rewards')
      : t('tabs.wallet');

  return (
    <div className="w-full min-w-0 overflow-x-hidden overflow-y-auto">
      <MemberPageShell>
        <MemberScreenTitle screen="wallet" memberTitle={memberTitle}>
          {/* Builder/funder only — MemberScreenTitle swaps this for members. */}
          <header className="craft-page-header">
            <p className="mb-1 text-1 font-medium text-muted-foreground">
              {t(titleKey)}
            </p>
            <h1 className="craft-page-title m-0 text-6 font-medium">
              {t('oneWallet')}
            </h1>
          </header>
        </MemberScreenTitle>
        {children}
      </MemberPageShell>
    </div>
  );
}
