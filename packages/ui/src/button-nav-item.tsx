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
};

export const ButtonNavItem = ({
  href,
  label,
  onClick,
  classNames,
  icon,
}: ButtonNavItemProps) => {
  const pathname = usePathname();
  const isActive = href && pathname.includes(href);
  const content = (
    <>
      {icon ? <span className="mr-1.5 inline-flex shrink-0">{icon}</span> : null}
      {label}
    </>
  );
  return (
    <Button
      key={label}
      variant="ghost"
      colorVariant="neutral"
      className={clsx(
        isActive && 'bg-neutral-3',
        'hover:bg-neutral-3',
        classNames,
      )}
      asChild={!!href}
      onClick={onClick}
    >
      {href ? <Link href={href}>{content}</Link> : <span>{content}</span>}
    </Button>
  );
};
