'use client';

import Link from 'next/link';
import { Button } from './button';
import { usePathname } from 'next/navigation';

type ButtonNavItemProps = {
  href: string;
  label: string;
};

export const ButtonNavItem = ({ href, label }: ButtonNavItemProps) => {
  const pathname = usePathname();
  const isActive = pathname.includes(href);
  return (
    <Button
      key={href}
      className={
        isActive
          ? 'bg-primary-foreground rounded-lg hover:bg-primary-foreground text-gray-400'
          : 'rounded-md bg-transparent hover:bg-primary-foreground text-gray-400'
      }
      asChild
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
};
