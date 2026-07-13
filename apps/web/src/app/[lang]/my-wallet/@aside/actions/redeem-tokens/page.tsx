'use client';

import { useParams } from 'next/navigation';
import { useMe } from '@hypha-platform/core/client';
import { ProfileRedeemTokens } from '@hypha-platform/epics';

export default function MyWalletRedeemTokensPage() {
  const { lang } = useParams<{ lang: string }>();
  const { person, isLoading } = useMe();

  if (isLoading || !person?.slug) {
    return null;
  }

  const basePath = `/${lang}/my-wallet`;

  return (
    <ProfileRedeemTokens
      lang={lang}
      personSlug={person.slug}
      closeUrl={basePath}
      backUrl={`${basePath}/actions`}
    />
  );
}
