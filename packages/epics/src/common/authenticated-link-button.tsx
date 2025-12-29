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
  const isMaintenanceMode = href === '#';

  if (hideInsteadDisabled && !isAuthenticated) {
    return null;
  }

  return (
    <Link
      href={isMaintenanceMode ? {} : isAuthenticated ? href : '#'}
      scroll={false}
      className={isMaintenanceMode ? 'cursor-not-allowed' : ''}
    >
      <Button
        title={
          isMaintenanceMode
            ? 'Under Maintenance'
            : !isAuthenticated
            ? 'Please sign in to use this feature.'
            : ''
        }
        disabled={
          isMaintenanceMode || (!isAuthenticated && !hideInsteadDisabled)
        }
        className="ml-2"
      >
        {children}
      </Button>
    </Link>
  );
}
