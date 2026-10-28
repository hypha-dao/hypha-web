'use client';

import type { ReactNode } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { SpaceAccessDenied } from '../../spaces/components/space-access-denied';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';

/** Signed-out account pages use the same gate as a space the person cannot open. */
export function AccountRequiredGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthentication();
  if (isLoading) return null;
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-0 w-full flex-1 items-center justify-center px-5 py-16">
        <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
