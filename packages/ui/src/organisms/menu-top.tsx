'use client';

import { Logo } from '../atoms';
import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { RxCross1 } from 'react-icons/rx';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

type MenuTopProps = {
  children?: React.ReactNode;
  /** Optional center slot (e.g. space breadcrumbs on DHO routes) */
  breadcrumbSlot?: React.ReactNode;
  leadingAction?: React.ReactNode;
  trailingAction?: React.ReactNode;
  logoHref?: string;
  hrefTarget?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
};

export const MenuTop = ({
  children,
  breadcrumbSlot,
  leadingAction,
  trailingAction,
  logoHref,
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

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [breadcrumbSlot]);

  const logoBlock = (
    <div className="flex shrink-0 items-center gap-2">
      {leadingAction}
      {!!logoHref && <Logo width={110} href={logoHref} target={hrefTarget} />}
    </div>
  );

  const desktopActions =
    children || trailingAction ? (
      <div
        id="menu-top-actions"
        className={clsx(
          'hidden shrink-0 items-center gap-2 md:flex',
          !breadcrumbSlot && !children && trailingAction && 'ml-auto',
        )}
      >
        {children}
        {trailingAction}
      </div>
    ) : null;

  return (
    <header
      ref={headerRef}
      className={clsx(
        'flex min-h-[65px] min-w-0 flex-shrink-0 items-center border-b border-border bg-background-2 py-3 z-30',
        breadcrumbSlot ? 'px-0' : 'gap-x-2 gap-y-2 px-4',
      )}
    >
      {breadcrumbSlot ? (
        <div className="mx-auto grid w-full min-w-0 max-w-container-2xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-5 sm:gap-x-3">
          {logoBlock}

          <div className="hidden min-h-[1.25rem] min-w-0 overflow-hidden md:flex md:items-center md:justify-start">
            <div className="max-w-full min-w-0 text-start text-muted-foreground [&_a]:text-foreground [&_a:hover]:text-accent-11">
              {breadcrumbSlot}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 md:justify-self-end">
            {desktopActions}
            {trailingAction && (
              <div className="flex md:hidden items-center">
                {trailingAction}
              </div>
            )}
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
          </div>

          {isMobileMenuOpen && (
            <div
              className="md:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col items-center p-4 bg-background-2 overflow-y-auto col-span-full"
              style={{ top: headerHeight }}
            >
              <div className="flex flex-col space-y-8 items-center">
                {children}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={clsx(
            'mx-auto flex w-full min-w-0 items-center gap-2 sm:gap-3',
            children ? 'justify-between' : 'justify-center',
          )}
        >
          {logoBlock}

          {desktopActions}

          {trailingAction && (
            <div className="flex md:hidden items-center">{trailingAction}</div>
          )}

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
      )}
    </header>
  );
};
