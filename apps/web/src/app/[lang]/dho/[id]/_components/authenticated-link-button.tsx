'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { ReactNode } from 'react';

type AuthLinkButtonProps = {
  href: string;
  children: ReactNode;
};

export function AuthenticatedLinkButton({
  href,
  children,
}: AuthLinkButtonProps) {
  const { isAuthenticated } = useAuthentication();

  return (
    <Link href={isAuthenticated ? href : '#'} scroll={false}>
      <Button
        title={!isAuthenticated ? 'Please sign in to use this feature.' : ''}
        disabled={!isAuthenticated}
        className="ml-2"
      >
        {children}
      </Button>
    </Link>
  );
}
