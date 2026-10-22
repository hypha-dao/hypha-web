'use client';

import { useMe, type Space } from '@hypha-platform/core/client';
import {
  PeopleBuySpaceTokens,
  PeoplePurchaseHyphaTokens,
} from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

type MyWalletPurchaseHyphaTokensClientProps = {
  spaces: Space[];
  closePanelUrl: string;
};

export function MyWalletPurchaseHyphaTokensClient({
  spaces,
  closePanelUrl,
}: MyWalletPurchaseHyphaTokensClientProps) {
  const { person, isLoading } = useMe();
  const t = useTranslations('MyWallet');

  if (isLoading || !person?.slug) {
    return <p className="text-2 text-neutral-11">{t('loading')}</p>;
  }

  return (
    <PeoplePurchaseHyphaTokens
      appearance="wallet"
      spaces={spaces}
      personSlug={person.slug}
      closePanelUrl={closePanelUrl}
    />
  );
}

type MyWalletBuySpaceTokensClientProps = {
  closeUrl: string;
};

export function MyWalletBuySpaceTokensClient({
  closeUrl,
}: MyWalletBuySpaceTokensClientProps) {
  const { person, isLoading } = useMe();
  const t = useTranslations('MyWallet');

  if (isLoading || !person?.slug) {
    return <p className="text-2 text-neutral-11">{t('loading')}</p>;
  }

  return (
    <PeopleBuySpaceTokens
      appearance="wallet"
      personSlug={person.slug}
      closeUrl={closeUrl}
    />
  );
}
