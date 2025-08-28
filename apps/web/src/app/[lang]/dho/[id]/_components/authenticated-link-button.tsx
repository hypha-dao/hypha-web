'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import Link from 'next/link';
import { ReactNode } from 'react';

type AuthLinkButtonProps = {
  href: string;
  children: ReactNode;
  hideInsteadDisabled?: boolean;
};

export function AuthenticatedLinkButton({
  href,
  children,
  hideInsteadDisabled = false,
}: AuthLinkButtonProps) {
  const { isAuthenticated } = useAuthentication();

  if (hideInsteadDisabled && !isAuthenticated) {
    return null;
  }

  return (
    <Link href={isAuthenticated ? href : '#'} scroll={false}>
      <Button
        title={!isAuthenticated ? 'Please sign in to use this feature.' : ''}
        disabled={!isAuthenticated && !hideInsteadDisabled}
        className="ml-2"
      >
        {children}
      </Button>
    </Link>
  );
}
