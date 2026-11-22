import { Locale } from '@hypha-platform/i18n';
import { Heading } from '@hypha-platform/ui';
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
          <header className="xl:hidden">
            <p className="mb-2 text-1 font-bold uppercase text-foreground">
              {t(titleKey)}
            </p>
            <h1
              className="text-7 leading-tight sm:text-8"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('oneWallet')}
            </h1>
          </header>
          <Heading
            size="9"
            color="secondary"
            weight="medium"
            align="center"
            className="hidden flex-col leading-none xl:flex"
          >
            <span>{t(titleKey)}</span>
            <span>{t('oneWallet')}</span>
          </Heading>
        </MemberScreenTitle>
        {children}
      </MemberPageShell>
    </div>
  );
}
