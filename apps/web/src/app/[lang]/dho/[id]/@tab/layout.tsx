import { Locale } from '@hypha-platform/i18n';
import { ReactNode } from 'react';
import { DhoSpaceWorkspace } from '../_components/dho-space-workspace';
import {
  getEnableCoherence,
  getEnableSpaceMemory,
} from '@hypha-platform/feature-flags';

export default async function TabLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  const [coherenceEnabled, spaceMemoryEnabled] = await Promise.all([
    getEnableCoherence(),
    getEnableSpaceMemory(),
  ]);
  return (
    <DhoSpaceWorkspace
      id={daoSlug}
      lang={lang}
      coherenceEnabled={coherenceEnabled}
      spaceMemoryEnabled={spaceMemoryEnabled}
    >
      {children}
    </DhoSpaceWorkspace>
  );
}
