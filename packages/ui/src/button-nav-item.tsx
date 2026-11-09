'use client';

import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import { Button } from './button';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

export type ButtonNavItemProps = {
  href?: string;
  label: string;
  classNames?: string;
  onClick?: React.MouseEventHandler;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Unread count drawn on the icon. Hidden at 0. */
  badge?: number;
  /** Replaces the visible label in the accessible name when a badge is showing. */
  ariaLabel?: string;
};

/** Dispatched before leaving Messages for Wallet so the mobile chat sheet closes. */
export const HYPHA_CLOSE_HUMAN_CHAT_EVENT = 'hypha:close-human-chat';

function isWalletHref(href: string | undefined): boolean {
  return Boolean(href?.includes('/my-wallet'));
}

function NavLinkPendingBody({
  children,
  forcePending,
}: {
  children: React.ReactNode;
  forcePending?: boolean;
}) {
  const { pending } = useLinkStatus();
  const busy = forcePending || pending;
  return (
    <span
      className={clsx('inline-flex items-center', busy && 'opacity-60')}
      aria-busy={busy || undefined}
    >
      {children}
    </span>
  );
}

export const ButtonNavItem = ({
  href,
  label,
  onClick,
  classNames,
  icon,
  disabled = false,
  badge = 0,
  ariaLabel,
}: ButtonNavItemProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = href && pathname.includes(href);
  const badgeLabel = badge > 99 ? '99+' : String(badge);
  const walletHref = isWalletHref(href);
  const [walletNavPending, setWalletNavPending] = useState(false);

  // Wallet (and other heavy first visits) feel stuck without a warm RSC/JS
  // cache. Prefetch as soon as the nav item mounts, not only on hover.
  useEffect(() => {
    if (!href || disabled || !walletHref) return;
    router.prefetch(href);
  }, [disabled, href, router, walletHref]);

  useEffect(() => {
    if (!walletNavPending) return;
    if (pathname.includes('/my-wallet')) {
      setWalletNavPending(false);
    }
  }, [pathname, walletNavPending]);

  const handleClick: React.MouseEventHandler = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || !href || disabled || !walletHref) return;

    // Soft nav from Messages can sit forever while Matrix still owns the main
    // thread — the old screen stays up and Wallet looks like it "never loads".
    event.preventDefault();
    setWalletNavPending(true);
    window.dispatchEvent(new Event(HYPHA_CLOSE_HUMAN_CHAT_EVENT));
    router.push(href);

    const target = href;
    window.setTimeout(() => {
      if (!window.location.pathname.includes('/my-wallet')) {
        window.location.assign(target);
      }
    }, 1200);
  };

  const content = (
    <>
      {icon ? (
        <span className="relative mr-1.5 inline-flex shrink-0 items-center overflow-visible text-current [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.25]">
          {icon}
          {badge > 0 ? (
            <span
              className="absolute -top-2 -right-2 inline-grid min-h-3 min-w-3 place-items-center bg-foreground px-1 text-[9px] font-medium leading-none tabular-nums text-background"
              aria-hidden
            >
              {badgeLabel}
            </span>
          ) : null}
        </span>
      ) : null}
      {label}
    </>
  );
  return (
    <Button
      key={label}
      variant="ghost"
      colorVariant="neutral"
      className={clsx(
        'overflow-visible rounded-none border-b border-transparent shadow-none hover:bg-transparent hover:border-foreground/25',
        isActive && 'border-accent-9 text-foreground hover:border-accent-9',
        classNames,
      )}
      asChild={!disabled && !!href}
      disabled={disabled}
      aria-busy={disabled || walletNavPending}
      aria-label={
        badge > 0 ? ariaLabel ?? `${label}, ${badgeLabel}` : undefined
      }
      onClick={handleClick}
    >
      {!disabled && href ? (
        <Link href={href} prefetch>
          <NavLinkPendingBody forcePending={walletNavPending}>
            {content}
          </NavLinkPendingBody>
        </Link>
      ) : (
        <span>{content}</span>
      )}
    </Button>
  );
};
