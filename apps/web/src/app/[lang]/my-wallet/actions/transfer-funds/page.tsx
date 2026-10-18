'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMe } from '@hypha-platform/core/client';
import { MemberHomeSendTokensWidget } from '@hypha-platform/epics';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

export default function MyWalletSendTokensPage() {
  const { lang } = useParams<{ lang: string }>();
  const t = useTranslations('MyWallet');
  const tHome = useTranslations('MemberHome');
  const { person, isLoading } = useMe();

  return (
    <WalletActionFrame lang={lang} backLabel={t('backToWallet')}>
      {isLoading || !person?.slug ? (
        <p className="text-2 text-neutral-11">{t('loading')}</p>
      ) : (
        <MemberHomeSendTokensWidget
          personSlug={person.slug}
          hasWallet={Boolean(person.address)}
          people={[]}
          spaces={[]}
          fallbackName={tHome('fallbackMember')}
        />
      )}
    </WalletActionFrame>
  );
}
