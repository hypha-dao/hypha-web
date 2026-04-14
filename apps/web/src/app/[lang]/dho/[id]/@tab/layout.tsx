import { getEnableCoherence } from '@hypha-platform/feature-flags';
import { Locale } from '@hypha-platform/i18n';
import { ReactNode } from 'react';
import { NavigationTabs } from '../_components/navigation-tabs';

export default async function TabLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  const coherenceEnabled = await getEnableCoherence();
  return (
    <>
      <NavigationTabs
        id={daoSlug}
        lang={lang}
        coherenceEnabled={coherenceEnabled}
      />
      {children}
    </>
  );
}
