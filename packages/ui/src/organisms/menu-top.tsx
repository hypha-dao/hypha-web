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

  return (
    <header
      ref={headerRef}
      className="flex min-h-[65px] min-w-0 flex-shrink-0 items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-background-2 px-4 py-3 z-30"
    >
      <div
        className={clsx(
          'mx-auto flex w-full min-w-0 items-center gap-2 sm:gap-3',
          !breadcrumbSlot && (children ? 'justify-between' : 'justify-center'),
        )}
      >
        <div className="flex shrink-0 items-center gap-2">
          {leadingAction}
          {!!logoHref && (
            <Logo width={110} href={logoHref} target={hrefTarget} />
          )}
        </div>

        {breadcrumbSlot ? (
          <div className="hidden min-h-[1.25rem] min-w-0 flex-1 overflow-hidden md:flex md:justify-center md:px-2">
            <div className="max-w-full min-w-0 text-muted-foreground [&_a]:text-foreground [&_a:hover]:text-accent-11">
              {breadcrumbSlot}
            </div>
          </div>
        ) : null}

        {/* Desktop Nav + Trailing action (right-aligned group) */}
        {(children || trailingAction) && (
          <div
            id="menu-top-actions"
            className={clsx(
              'hidden shrink-0 items-center gap-2 md:flex',
              breadcrumbSlot && 'ml-auto',
            )}
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
