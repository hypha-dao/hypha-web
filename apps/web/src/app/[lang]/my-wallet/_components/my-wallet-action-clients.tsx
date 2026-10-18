'use client';

import { useMe, type Space } from '@hypha-platform/core/client';
import {
  PeopleBuySpaceTokens,
  PeoplePurchaseHyphaTokens,
} from '@hypha-platform/epics';

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
