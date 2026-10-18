'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMe } from '@hypha-platform/core/client';
import { ProfileRedeemTokens } from '@hypha-platform/epics';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

export default function MyWalletRedeemTokensPage() {
  const { lang } = useParams<{ lang: string }>();
  const t = useTranslations('MyWallet');
  const tModalAside = useTranslations('ModalAside');
  const { person, isLoading } = useMe();

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={tModalAside('redeemTokens')}
    >
      {isLoading || !person?.slug ? (
        <p className="text-2 text-neutral-11">{t('loading')}</p>
      ) : (
        <ProfileRedeemTokens
          embedded
          lang={lang}
          personSlug={person.slug}
          closeUrl={`/${lang}/my-wallet`}
        />
      )}
    </WalletActionFrame>
  );
}
