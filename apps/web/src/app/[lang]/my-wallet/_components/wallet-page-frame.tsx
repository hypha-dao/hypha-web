import { Locale } from '@hypha-platform/i18n';
import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

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

  return (
    <div className="w-full min-w-0 overflow-x-hidden overflow-y-auto">
      <Container className="flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:py-9">
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
        {children}
      </Container>
    </div>
  );
}
