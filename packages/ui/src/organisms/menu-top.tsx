'use client';

import { Logo } from '../atoms';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { RxCross1 } from 'react-icons/rx';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

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
};

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
  compactSafeThresholdPx = 232,
  compactReleaseThresholdPx = 256,
  compactDataAttribute = 'data-compact-header',
  showLeadingActionOnlyWhenCompact = false,
}: MenuTopProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const leadingClusterRef = useRef<HTMLDivElement>(null);
  const desktopActionsRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
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
    let compactRef = isCompact;
    const evaluate = () => {
      raf = 0;
      const rowWidth = rowEl.getBoundingClientRect().width;
      const leadWidth = leadEl.getBoundingClientRect().width;
      // Keep measurable even when visually hidden; use scrollWidth as "needed" width.
      const desktopNeeded = Math.max(
        desktopEl.scrollWidth,
        desktopEl.getBoundingClientRect().width,
      );
      const freeSpace = rowWidth - leadWidth - desktopNeeded - 16;

      const shouldCompact = compactRef
        ? freeSpace < compactReleaseThresholdPx
        : freeSpace < compactSafeThresholdPx;

      if (shouldCompact !== compactRef) {
        compactRef = shouldCompact;
        setIsCompact(shouldCompact);
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
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      if (raf !== 0) {
        window.cancelAnimationFrame(raf);
      }
      ro.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [compactReleaseThresholdPx, compactSafeThresholdPx, isCompact]);

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

        {/* Desktop Nav + Trailing action (right-aligned group) */}
        {(children || trailingAction) && (
          <div
            ref={desktopActionsRef}
            id="menu-top-actions"
            className={clsx(
              'items-center gap-2',
              isCompact
                ? 'pointer-events-none invisible absolute'
                : 'relative flex',
            )}
          >
            {children}
            {trailingAction}
          </div>
        )}

        {/* Compact action group (right side): chat, profile, optional hamburger */}
        <div
          className={clsx(
            'ml-auto items-center gap-2',
            isCompact ? 'flex' : 'hidden',
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
        {showMobileHamburger && isCompact && isMobileMenuOpen && (
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
