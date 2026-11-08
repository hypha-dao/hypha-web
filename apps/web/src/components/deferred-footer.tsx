'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
 *
 * When the footer is on screen it is also pinned `fixed` full viewport width.
 * In dual-panel layout the footer lives in the center column; without the pin
 * it only paints between the rails while the side panels cover the sides.
 */
function SiteFooterOffsetSync({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pinHeight, setPinHeight] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const footer =
        rootRef.current?.querySelector('[data-site-footer]') ??
        rootRef.current?.querySelector('footer') ??
        document.querySelector('[data-site-footer]');
      if (!(footer instanceof HTMLElement)) {
        clearSiteFooterOffset();
        setPinHeight(null);
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
      // Pin full-bleed once the footer is meaningfully on screen. Keep the
      // in-flow spacer height so scroll length does not jump.
      setPinHeight(overlap > 0 ? Math.ceil(rect.height) : null);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(document.documentElement);
    const footerEl =
      rootRef.current?.querySelector('[data-site-footer]') ??
      rootRef.current?.querySelector('footer');
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

  const pinned = pinHeight != null && pinHeight > 0;

  return (
    <div
      ref={rootRef}
      className="shrink-0"
      style={pinned ? { height: pinHeight } : undefined}
    >
      <div
        data-site-footer-pinned={pinned ? '' : undefined}
        className={pinned ? 'fixed inset-x-0 bottom-0 z-[45]' : undefined}
      >
        {children}
      </div>
    </div>
  );
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
