'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';

/**
 * Sign in / sign out of a mapped host, next to the section menu. Goes through
 * the same `useAuthentication` seam as the shared sections. Rendered only on a
 * host with login settings. Sign out stays on the host: the main app's default
 * (redirect to its network page) would leave the Space.
 */
export function WhiteLabelAuthControl() {
  const t = useTranslations('Navigation');
  const { isAuthenticated, isLoading, login, logout } = useAuthentication();

  if (isLoading) return null;

  return (
    <div className="mt-4 flex shrink-0 items-center py-1">
      {isAuthenticated ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void logout(false);
          }}
        >
          {t('logout')}
        </Button>
      ) : (
        <Button size="sm" onClick={() => void login()}>
          {t('signIn')}
        </Button>
      )}
    </div>
  );
}
