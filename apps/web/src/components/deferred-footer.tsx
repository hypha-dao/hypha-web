'use client';

import { useNetworkGlobeReady } from '@hypha-platform/epics';
import { Footer, type FooterProps } from '@hypha-platform/ui';
import { usePathname, useSearchParams } from 'next/navigation';

function isNetworkMapView(pathname: string, view: string | null): boolean {
  if (!/\/network\/?$/.test(pathname)) {
    return false;
  }
  return view !== 'list';
}

export function DeferredFooter(props: FooterProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const globeReady = useNetworkGlobeReady();
  const view = searchParams.get('view');

  if (isNetworkMapView(pathname, view) && !globeReady) {
    return null;
  }

  return <Footer {...props} />;
}
