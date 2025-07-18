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
};

export const ButtonNavItem = ({
  href,
  label,
  onClick,
  classNames,
}: ButtonNavItemProps) => {
  const pathname = usePathname();
  const isActive = href && pathname.includes(href);
  console.log(isActive, href, pathname, label);
  return (
    <Button
      key={label}
      variant="ghost"
      colorVariant="neutral"
      className={clsx(
        isActive && 'bg-primary-foreground',
        'hover:bg-primary-foreground',
        classNames,
      )}
      asChild={!!href}
      onClick={onClick}
    >
      {!!href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
    </Button>
  );
};
