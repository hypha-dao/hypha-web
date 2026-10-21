'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMe } from '@hypha-platform/core/client';
import { MemberHomeSendTokensWidget } from '@hypha-platform/epics';
import { WalletActionFrame } from '../../_components/wallet-action-frame';

export default function MyWalletSendTokensPage() {
  const { lang } = useParams<{ lang: string }>();
  const searchParams = useSearchParams();
  const t = useTranslations('MyWallet');
  const tHome = useTranslations('MemberHome');
  const { person, isLoading } = useMe();
  const token = searchParams.get('token')?.trim() ?? '';
  const initialTokenAddress = /^0x[a-fA-F0-9]{40}$/.test(token)
    ? token
    : undefined;
  const recipientAddress = searchParams.get('to')?.trim() ?? '';
  const recipientName = searchParams.get('name')?.trim() ?? '';
  const initialRecipient = /^0x[a-fA-F0-9]{40}$/.test(recipientAddress)
    ? { address: recipientAddress, name: recipientName }
    : undefined;

  return (
    <WalletActionFrame
      lang={lang}
      backLabel={t('backToWallet')}
      title={t('shortcuts.transfer')}
    >
      {isLoading || !person?.slug ? (
        <p className="text-2 text-neutral-11">{t('loading')}</p>
      ) : (
        <MemberHomeSendTokensWidget
          key={`${initialTokenAddress ?? 'send'}:${
            initialRecipient?.address ?? ''
          }`}
          personSlug={person.slug}
          hasWallet={Boolean(person.address)}
          people={[]}
          spaces={[]}
          fallbackName={tHome('fallbackMember')}
          framed={false}
          initialTokenAddress={initialTokenAddress}
          initialRecipient={initialRecipient}
        />
      )}
    </WalletActionFrame>
  );
}
