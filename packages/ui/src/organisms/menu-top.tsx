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
  logoHref?: string;
  logoText?: string;
  logoNode?: React.ReactNode;
  hrefTarget?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
};

export const MenuTop = ({
  children,
  leadingAction,
  trailingAction,
  logoHref,
  logoText,
  logoNode,
  hrefTarget,
  openMenuLabel = 'Open menu',
  closeMenuLabel = 'Close menu',
}: MenuTopProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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

  return (
    <header
      ref={headerRef}
      className={clsx(
        'relative flex h-[65px] min-w-0 flex-shrink-0 items-center justify-between gap-x-2 gap-y-2',
        'bg-background-2 px-4 py-3 z-30',
        /*
         * Span the flex gap between SidebarInset and fixed side rails (human/AI panels).
         * Mirror vars come from PanelWrapLayout on `:root`; without this the rule stops at the
         * inset edge and misses the junction with `Sidebar` border-r / border-l.
         * Also extend past the main column scrollbar gutter (`--main-column-scrollbar-width`) so
         * the rule meets the side panel border — same inset logic as sticky DHO chrome.
         */
        'after:pointer-events-none after:absolute after:bottom-0 after:h-px after:bg-border',
        'after:left-[calc(-1_*_var(--sidebar-left-width,0px))]',
        'after:right-[calc((-1_*_var(--sidebar-right-width,0px))_-_var(--main-column-scrollbar-width,0px))]',
      )}
    >
      <div
        className={clsx(
          'w-full mx-auto flex items-center',
          children ? 'justify-between' : 'justify-center',
        )}
      >
        <div className="flex items-center gap-2">
          {leadingAction}
          {logoNode ? (
            logoNode
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
            id="menu-top-actions"
            className="hidden md:flex items-center gap-2"
          >
            {children}
            {trailingAction}
          </div>
        )}

        {/* Mobile trailing action (always visible on small screens) */}
        {trailingAction && (
          <div className="flex md:hidden items-center">{trailingAction}</div>
        )}

        {/* Mobile Burger */}
        {children && (
          <button
            type="button"
            className="md:hidden flex items-center"
            aria-label={isMobileMenuOpen ? closeMenuLabel : openMenuLabel}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
          >
            {!isMobileMenuOpen && <Menu className="size-5" />}
            {isMobileMenuOpen && <RxCross1 className="size-5" />}
          </button>
        )}

        {/* Mobile Full Screen Menu */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col items-center p-4 bg-background-2 overflow-y-auto"
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
