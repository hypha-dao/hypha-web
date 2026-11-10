'use client';

import type { ReactNode } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { SpaceAccessDenied } from '../../spaces/components/space-access-denied';
import { UserSpaceState } from '../../spaces/hooks/use-user-space-state.web3.rpc';

/** Signed-out account pages use the same gate as a space the person cannot open. */
export function AccountRequiredGate({
  children,
  loadingFallback = null,
}: {
  children: ReactNode;
  /**
   * Shown while Privy auth is still resolving. Prefer a page shell skeleton
   * over `null` so the title alone does not flash on a white canvas.
   */
  loadingFallback?: ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuthentication();
  if (isLoading) return <>{loadingFallback}</>;
  if (!isAuthenticated) {
    // Match Wallet: sit under the page title, not centered in a tall slab.
    return <SpaceAccessDenied userState={UserSpaceState.NOT_LOGGED_IN} />;
  }
  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      {children}
    </div>
  );
}
