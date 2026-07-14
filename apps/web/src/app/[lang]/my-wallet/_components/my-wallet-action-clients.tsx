'use client';

import { useParams } from 'next/navigation';
import { useMe, type Person, type Space } from '@hypha-platform/core/client';
import {
  PeopleBuySpaceTokens,
  PeoplePurchaseHyphaTokens,
  ProfileTransferFunds,
} from '@hypha-platform/epics';

type MyWalletTransferFundsClientProps = {
  spaces: Space[];
  peoples: Person[];
};

export function MyWalletTransferFundsClient({
  spaces,
  peoples,
}: MyWalletTransferFundsClientProps) {
  const { lang } = useParams<{ lang: string }>();
  const { person, isLoading } = useMe();

  if (isLoading || !person?.slug) {
    return null;
  }

  const basePath = `/${lang}/my-wallet`;

  return (
    <ProfileTransferFunds
      lang={lang}
      spaces={spaces}
      peoples={peoples}
      personSlug={person.slug}
      closeUrl={basePath}
      backUrl={`${basePath}/actions`}
    />
  );
}

type MyWalletPurchaseHyphaTokensClientProps = {
  spaces: Space[];
  closePanelUrl: string;
};

export function MyWalletPurchaseHyphaTokensClient({
  spaces,
  closePanelUrl,
}: MyWalletPurchaseHyphaTokensClientProps) {
  const { person, isLoading } = useMe();

  if (isLoading || !person?.slug) {
    return null;
  }

  return (
    <PeoplePurchaseHyphaTokens
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

  if (isLoading || !person?.slug) {
    return null;
  }

  return <PeopleBuySpaceTokens personSlug={person.slug} closeUrl={closeUrl} />;
}
