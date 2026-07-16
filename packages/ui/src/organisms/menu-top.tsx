'use client';

import { Logo } from '../atoms';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { RxCross1 } from 'react-icons/rx';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';
import {
  resolveDesktopClusterWidth,
  shouldUseCompactHeader,
} from './menu-top-compact';

type MenuTopProps = {
  children?: React.ReactNode;
  leadingAction?: React.ReactNode;
  trailingAction?: React.ReactNode;
  mobileAction?: React.ReactNode;
  logoHref?: string;
  logoText?: string;
  logoNode?: React.ReactNode;
  hrefTarget?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  showMobileHamburger?: boolean;
  compactSafeThresholdPx?: number;
  compactReleaseThresholdPx?: number;
  compactDataAttribute?: string;
  showLeadingActionOnlyWhenCompact?: boolean;
  /** When true, collapse desktop nav while the left AI panel is expanded (overlay or rail). */
  forceCompactWhenLeftPanelExpanded?: boolean;
};

/** Gap reserved between leading cluster and desktop actions in the free-space math. */
const ROW_CLUSTER_GAP_PX = 16;

export const MenuTop = ({
  children,
  leadingAction,
  trailingAction,
  mobileAction,
  logoHref,
  logoText,
  logoNode,
  hrefTarget,
  openMenuLabel = 'Open menu',
  closeMenuLabel = 'Close menu',
  showMobileHamburger = true,
  // Wider band than the original 232/256: My Wallet widened the desktop cluster,
  // so iPad-landscape widths sit near the threshold and need more hysteresis.
  compactSafeThresholdPx = 232,
  compactReleaseThresholdPx = 320,
  compactDataAttribute = 'data-compact-header',
  showLeadingActionOnlyWhenCompact = false,
  forceCompactWhenLeftPanelExpanded = true,
}: MenuTopProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const leadingClusterRef = useRef<HTMLDivElement>(null);
  const desktopActionsRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  // Conservative SSR/first-paint: prefer compact until measured (avoids overlap flash).
  const [isCompact, setIsCompact] = useState(true);
  const isCompactRef = useRef(true);
  const desktopNeededRef = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showMobileHamburger) {
      setIsMobileMenuOpen(false);
    }
  }, [showMobileHamburger]);

  /** Publish measured height so side panels / overlays align with this bar (see e2e menu-top-consistent-height). */
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el || typeof document === 'undefined') return;

    const publish = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty(
          '--menu-top-height',
          `${h}px`,
        );
        setHeaderHeight(h);
      }
    };

    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--menu-top-height');
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const rowEl = rowRef.current;
    const leadEl = leadingClusterRef.current;
    const desktopEl = desktopActionsRef.current;
    if (!rowEl || !leadEl || !desktopEl) return;

    let raf = 0;
    const mobileMq = window.matchMedia('(max-width: 767px)');

    const evaluate = () => {
      raf = 0;
      const root = document.documentElement;
      const rowWidth = rowEl.getBoundingClientRect().width;
      const leadWidth = leadEl.getBoundingClientRect().width;
      const liveDesktopWidth = Math.max(
        desktopEl.scrollWidth,
        desktopEl.offsetWidth,
        desktopEl.getBoundingClientRect().width,
      );
      const desktopNeeded = resolveDesktopClusterWidth({
        measuredPx: liveDesktopWidth,
        isCompact: isCompactRef.current,
        cachedPx: desktopNeededRef.current,
      });
      if (desktopNeeded > 0) {
        desktopNeededRef.current = desktopNeeded;
      }

      const freeSpace =
        rowWidth - leadWidth - desktopNeeded - ROW_CLUSTER_GAP_PX;
      const leftPanelExpanded =
        forceCompactWhenLeftPanelExpanded &&
        root.getAttribute('data-left-panel-expanded') === 'true';

      const nextCompact = shouldUseCompactHeader({
        freeSpacePx: freeSpace,
        isCurrentlyCompact: isCompactRef.current,
        leftPanelExpanded,
        enterBelowPx: compactSafeThresholdPx,
        exitBelowPx: compactReleaseThresholdPx,
        forceCompactViewport: mobileMq.matches,
      });

      if (nextCompact !== isCompactRef.current) {
        isCompactRef.current = nextCompact;
        setIsCompact(nextCompact);
      }
    };

    const schedule = () => {
      if (raf !== 0) return;
      raf = window.requestAnimationFrame(evaluate);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(rowEl);
    ro.observe(leadEl);
    ro.observe(desktopEl);
    const panelObserver = new MutationObserver(schedule);
    panelObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-left-panel-expanded'],
    });
    const onMobileMq = () => schedule();
    if (typeof mobileMq.addEventListener === 'function') {
      mobileMq.addEventListener('change', onMobileMq);
    } else {
      // Safari < 14
      mobileMq.addListener(onMobileMq);
    }
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      if (raf !== 0) {
        window.cancelAnimationFrame(raf);
      }
      ro.disconnect();
      panelObserver.disconnect();
      if (typeof mobileMq.removeEventListener === 'function') {
        mobileMq.removeEventListener('change', onMobileMq);
      } else {
        mobileMq.removeListener(onMobileMq);
      }
      window.removeEventListener('resize', schedule);
    };
    // Intentionally omit `isCompact`: hysteresis lives in isCompactRef so toggling
    // compact does not tear down ResizeObserver (which itself caused re-entry jitter).
  }, [
    compactReleaseThresholdPx,
    compactSafeThresholdPx,
    forceCompactWhenLeftPanelExpanded,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(
      compactDataAttribute,
      isCompact ? 'true' : 'false',
    );
    return () => {
      document.documentElement.removeAttribute(compactDataAttribute);
    };
  }, [compactDataAttribute, isCompact]);

  return (
    <header
      ref={headerRef}
      className={clsx(
        'relative flex h-[70px] min-w-0 flex-shrink-0 items-center justify-between gap-x-2 gap-y-2',
        'bg-background-2 px-4 py-3 z-30',
        /*
         * Span the flex gap between SidebarInset and the fixed left rail so the underline meets
         * the sidebar seam cleanly. The right panel draws its own matching border, which avoids
         * a doubled or awkward underline where the main top menu and right panel meet.
         */
        'after:pointer-events-none after:absolute after:bottom-0 after:h-px after:bg-border',
        'after:left-[calc(-1_*_var(--sidebar-left-width,0px))]',
        'after:right-0',
      )}
    >
      <div
        ref={rowRef}
        className={clsx(
          'w-full mx-auto flex min-w-0 items-center',
          children ? 'justify-between' : 'justify-center',
        )}
      >
        <div
          ref={leadingClusterRef}
          className="flex min-w-0 items-center gap-2"
        >
          {leadingAction ? (
            <div
              className={
                showLeadingActionOnlyWhenCompact && !isCompact ? 'hidden' : ''
              }
            >
              {leadingAction}
            </div>
          ) : null}
          {logoNode ? (
            logoHref ? (
              <Link
                href={logoHref}
                target={hrefTarget}
                rel={
                  hrefTarget === '_blank' ? 'noopener noreferrer' : undefined
                }
              >
                {logoNode}
              </Link>
            ) : (
              logoNode
            )
          ) : logoText ? (
            logoHref ? (
              <Link
                href={logoHref}
                target={hrefTarget}
                rel={
                  hrefTarget === '_blank' ? 'noopener noreferrer' : undefined
                }
                className="inline-block max-w-[22rem] truncate text-3xl font-medium leading-none tracking-tight text-foreground"
              >
                {logoText}
              </Link>
            ) : (
              <span className="inline-block max-w-[22rem] truncate text-3xl font-medium leading-none tracking-tight text-foreground">
                {logoText}
              </span>
            )
          ) : logoHref ? (
            <Logo width={110} href={logoHref} target={hrefTarget} />
          ) : null}
        </div>

        {/* Desktop Nav + Trailing action (right-aligned group).
            When compact, keep `flex w-max` so intrinsic width stays measurable;
            dropping `flex` was collapsing scrollWidth on iPad WebKit and
            oscillating compact ↔ expanded every frame. */}
        {(children || trailingAction) && (
          <div
            ref={desktopActionsRef}
            id="menu-top-actions"
            className={clsx(
              'flex w-max items-center gap-2',
              isCompact
                ? // Keep flex + intrinsic width while out of flow. Zero-height clip
                  // avoids document scroll growth; cache still guards WebKit quirks.
                  'pointer-events-none absolute left-0 top-0 h-0 overflow-hidden opacity-0'
                : 'relative',
            )}
            aria-hidden={isCompact || undefined}
          >
            {children}
            {trailingAction}
          </div>
        )}

        {/* Compact action group (right side): chat, profile, optional hamburger.
            Always show below `md` so auth (e.g. Sign in) stays visible whenever the
            desktop action row is hidden by the app layout; `isCompact` still controls
            md+ when the desktop group is collapsed into this column. */}
        <div
          className={clsx(
            'ml-auto items-center gap-2 max-md:flex',
            isCompact ? 'md:flex' : 'md:hidden',
          )}
        >
          {trailingAction ? (
            <div className="flex shrink-0 items-center">{trailingAction}</div>
          ) : null}
          {mobileAction ? (
            <div className="flex shrink-0 items-center">{mobileAction}</div>
          ) : null}
          {showMobileHamburger ? (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center"
              aria-label={isMobileMenuOpen ? closeMenuLabel : openMenuLabel}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
            >
              {!isMobileMenuOpen && <Menu className="size-5" />}
              {isMobileMenuOpen && <RxCross1 className="size-5" />}
            </button>
          ) : null}
        </div>

        {/* Mobile Full Screen Menu */}
        {showMobileHamburger && isMobileMenuOpen && (
          <div
            id="mobile-menu"
            className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center overflow-y-auto bg-background-2 p-4"
            style={{ top: headerHeight }}
          >
            <div className="flex flex-col space-y-8 items-center">
              {children}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
