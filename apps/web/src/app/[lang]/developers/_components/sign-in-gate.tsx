'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';

/** Everything past the landing page needs a signed-in Hypha user. */
export function SignInGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, login } = useAuthentication();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-2 text-muted-foreground">
          Sign in with your Hypha account to register and manage integration
          clients.
        </p>
        <Button onClick={() => void login()}>Sign in</Button>
      </div>
    );
  }
  return <>{children}</>;
}
