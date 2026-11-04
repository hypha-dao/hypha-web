'use client';

import { useParams } from 'next/navigation';
import { useMe } from '@hypha-platform/core/client';
import { WalletActionsPanel } from '@hypha-platform/epics';

export default function MyWalletActionsPage() {
  const { lang } = useParams<{ lang: string }>();
  const { person, isLoading } = useMe();

  if (isLoading || !person?.slug) {
    return null;
  }

  return (
    <WalletActionsPanel
      lang={lang}
      personSlug={person.slug}
      basePath={`/${lang}/my-wallet`}
    />
  );
}
