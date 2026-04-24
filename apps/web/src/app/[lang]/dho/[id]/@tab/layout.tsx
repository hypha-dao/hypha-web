import { Locale } from '@hypha-platform/i18n';
import { ReactNode } from 'react';
import { NavigationTabs } from '../_components/navigation-tabs';
import { DhoSpaceWorkspace } from '../_components/dho-space-workspace';
import {
  getEnableCoherence,
  getEnableDhoWorkspaceNav,
} from '@hypha-platform/feature-flags';

export default async function TabLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  const coherenceEnabled = await getEnableCoherence();
  const dhoWorkspaceNav = await getEnableDhoWorkspaceNav();
  if (dhoWorkspaceNav) {
    return (
      <DhoSpaceWorkspace
        id={daoSlug}
        lang={lang}
        coherenceEnabled={coherenceEnabled}
      >
        {children}
      </DhoSpaceWorkspace>
    );
  }
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
