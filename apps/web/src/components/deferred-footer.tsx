'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID } from '@hypha-platform/core/client';
import { useNetworkGlobeReady } from '@hypha-platform/epics';
import { Footer, type FooterProps } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  SITE_FOOTER_OFFSET_VAR,
  isScrollRootAtEnd,
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

function readScrollRoot(): HTMLElement | Element | null {
  return (
    document.getElementById(HYPHA_SCREEN_SHARE_MAIN_CONTENT_ID) ??
    document.scrollingElement
  );
}

/**
 * Publishes `--site-footer-offset` so fixed sidebars (chat / AI) and the
 * sticky messages list lift above the visible "Powered by Hypha" bar.
 *
 * The footer only appears once the main column is fully scrolled. Until then
 * it stays in flow (reserving height) but invisible, so it cannot peek in the
 * center column or pin early. At scroll-end it pins full viewport width.
 *
 * Messages (and similar) cap an inner list after paint — the first measure can
 * see a short scrollHeight and wrongly treat the page as already at end. We
 * re-observe main-column children so that later height lock clears the pin.
 */
function SiteFooterOffsetSync({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pinHeight, setPinHeight] = useState<number | null>(null);
  const [atScrollEnd, setAtScrollEnd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const sync = () => {
      if (cancelled) return;
      const footer =
        rootRef.current?.querySelector('[data-site-footer]') ??
        rootRef.current?.querySelector('footer') ??
        document.querySelector('[data-site-footer]');
      if (!(footer instanceof HTMLElement)) {
        clearSiteFooterOffset();
        setPinHeight(null);
        setAtScrollEnd(false);
        return;
      }

      const scrollRoot = readScrollRoot();
      const atEnd =
        scrollRoot instanceof HTMLElement || scrollRoot instanceof Element
          ? isScrollRootAtEnd({
              scrollTop: 'scrollTop' in scrollRoot ? scrollRoot.scrollTop : 0,
              clientHeight:
                'clientHeight' in scrollRoot
                  ? scrollRoot.clientHeight
                  : window.innerHeight,
              scrollHeight:
                'scrollHeight' in scrollRoot
                  ? scrollRoot.scrollHeight
                  : footer.offsetHeight,
            })
          : false;

      if (!atEnd) {
        clearSiteFooterOffset();
        setPinHeight(null);
        setAtScrollEnd(false);
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
      setAtScrollEnd(true);
      setPinHeight(Math.ceil(rect.height) || null);
    };

    const sizeObserver = new ResizeObserver(sync);
    sizeObserver.observe(document.documentElement);

    const contentObserver = new ResizeObserver(sync);
    const bindContentTargets = () => {
      contentObserver.disconnect();
      const scrollRoot = readScrollRoot();
      if (scrollRoot instanceof HTMLElement) {
        for (const child of scrollRoot.children) {
          contentObserver.observe(child);
        }
      }
      // MessagesViewportLock writes height onto this node after first paint.
      const listFrame = document.querySelector('[data-messages-list-frame]');
      if (listFrame instanceof HTMLElement) {
        contentObserver.observe(listFrame);
      }
      const footerEl =
        rootRef.current?.querySelector('[data-site-footer]') ??
        rootRef.current?.querySelector('footer');
      if (footerEl instanceof HTMLElement) {
        contentObserver.observe(footerEl);
      }
    };
    bindContentTargets();

    const scrollRoot = readScrollRoot();
    const childListObserver =
      scrollRoot instanceof HTMLElement
        ? new MutationObserver(bindContentTargets)
        : null;
    if (scrollRoot instanceof HTMLElement && childListObserver) {
      childListObserver.observe(scrollRoot, { childList: true });
    }

    scrollRoot?.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('resize', sync);

    sync();
    // Catch the post-paint messages list cap (and similar layout locks).
    raf = window.requestAnimationFrame(() => {
      bindContentTargets();
      sync();
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        sync();
      });
    });

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      sizeObserver.disconnect();
      contentObserver.disconnect();
      childListObserver?.disconnect();
      scrollRoot?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      clearSiteFooterOffset();
    };
  }, []);

  const pinned = atScrollEnd && pinHeight != null && pinHeight > 0;

  return (
    <div
      ref={rootRef}
      className="shrink-0"
      style={pinned ? { height: pinHeight } : undefined}
    >
      <div
        data-site-footer-pinned={pinned ? '' : undefined}
        aria-hidden={atScrollEnd ? undefined : true}
        className={cn(
          pinned && 'fixed inset-x-0 bottom-0 z-[45]',
          !atScrollEnd && 'pointer-events-none invisible',
        )}
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
