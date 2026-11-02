import { Locale } from '@hypha-platform/i18n';
import { ReactNode } from 'react';

export default async function TabLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string; lang: Locale }>;
}) {
  await params;
  return <>{children}</>;
}
