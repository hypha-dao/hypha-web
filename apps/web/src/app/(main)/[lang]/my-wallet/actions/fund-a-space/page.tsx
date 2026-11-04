'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FundASpaceFlow } from '@hypha-platform/epics';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

export default function MyWalletFundASpacePage() {
  const { lang } = useParams<{ lang: string }>();
  const t = useTranslations('MyWallet');

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={t('shortcuts.fundSpace')}
    >
      <FundASpaceFlow />
    </WalletActionFrame>
  );
}
