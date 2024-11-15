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
    <Button key={href} style={{color: "#B0B4BA"}} className={isActive ? 'bg-primary-foreground rounded-lg hover:bg-primary-foreground' : 'rounded-md bg-transparent hover:bg-primary-foreground' } asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
};
