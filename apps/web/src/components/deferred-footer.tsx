'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID } from '@hypha-platform/core/client';
import { useNetworkGlobeReady } from '@hypha-platform/epics';
import { Footer, type FooterProps } from '@hypha-platform/ui';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  SITE_FOOTER_OFFSET_VAR,
  siteFooterViewportOverlap,
} from './site-footer-offset';

function isNetworkMapView(pathname: string, view: string | null): boolean {
  if (!/\/network\/?$/.test(pathname)) {
    return false;
  }
  return view !== 'list';
}

/** Member home fills the viewport. The site footer sits under that frame. */
function isMemberHome(pathname: string): boolean {
  return /^\/[^/]+\/(?:my-dashboard|home)\/?$/.test(pathname);
}

function clearSiteFooterOffset() {
  document.documentElement.style.removeProperty(SITE_FOOTER_OFFSET_VAR);
}

/**
 * Publishes `--site-footer-offset` so fixed sidebars (chat / AI) and the
 * sticky messages list lift above the visible "Powered by Hypha" bar.
 */
function SiteFooterOffsetSync({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      const footer =
        rootRef.current?.querySelector('footer') ??
        document.querySelector('footer');
      if (!(footer instanceof HTMLElement)) {
        clearSiteFooterOffset();
        return;
      }
      const rect = footer.getBoundingClientRect();
      const overlap = siteFooterViewportOverlap({
        footerTop: rect.top,
        footerHeight: rect.height,
        viewportHeight: window.innerHeight,
      });
      document.documentElement.style.setProperty(
        SITE_FOOTER_OFFSET_VAR,
        `${overlap}px`,
      );
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(document.documentElement);
    const footerEl = rootRef.current?.querySelector('footer');
    if (footerEl) observer.observe(footerEl);

    const scrollRoot =
      document.getElementById(HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID) ??
      document.scrollingElement;
    scrollRoot?.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('resize', sync);

    return () => {
      observer.disconnect();
      scrollRoot?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      clearSiteFooterOffset();
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}

export function DeferredFooter(props: FooterProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const globeReady = useNetworkGlobeReady();
  const view = searchParams.get('view');

  useEffect(() => {
    if (isMemberHome(pathname)) {
      clearSiteFooterOffset();
    }
  }, [pathname]);

  if (isMemberHome(pathname)) {
    return null;
  }

  if (isNetworkMapView(pathname, view) && !globeReady) {
    return null;
  }

  return (
    <SiteFooterOffsetSync>
      <Footer {...props} />
    </SiteFooterOffsetSync>
  );
}
