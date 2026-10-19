'use client';

import Link from 'next/link';
import { Button } from './button';
import { usePathname } from 'next/navigation';
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
  const isActive = href && pathname.includes(href);
  const badgeLabel = badge > 99 ? '99+' : String(badge);
  const content = (
    <>
      {icon ? (
        <span className="relative mr-1.5 inline-flex shrink-0 items-center overflow-visible text-current [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.25]">
          {icon}
          {badge > 0 ? (
            <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center bg-foreground px-0.5 text-[9px] leading-none text-background">
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
      aria-busy={disabled}
      aria-label={
        badge > 0 ? ariaLabel ?? `${label}, ${badgeLabel}` : undefined
      }
      onClick={onClick}
    >
      {!disabled && href ? (
        <Link href={href}>{content}</Link>
      ) : (
        <span>{content}</span>
      )}
    </Button>
  );
};
