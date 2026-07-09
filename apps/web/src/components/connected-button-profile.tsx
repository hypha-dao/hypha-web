'use client';

import { ConnectedButtonProfile as EpicsConnectedButtonProfile } from '@hypha-platform/epics';
import { clearOnboardingWalletSessionActive } from '@hypha-platform/epics';
import {
  useAuthentication,
  resolvePostAuthRedirectPathOrDefault,
} from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import type { ComponentProps } from 'react';
import { useCallback, useMemo } from 'react';

type ConnectedButtonProfileProps = Omit<
  ComponentProps<typeof EpicsConnectedButtonProfile>,
  'useAuthentication' | 'useMe' | 'resolvePostAuthRedirectPathOrDefault'
>;

function useAuthenticationWithWalletSessionCleanup() {
  const auth = useAuthentication();
  const logout = useCallback(
    (redirect?: boolean) => {
      clearOnboardingWalletSessionActive();
      auth.logout(redirect);
    },
    [auth],
  );

  return useMemo(() => ({ ...auth, logout }), [auth, logout]);
}

export function ConnectedButtonProfile(props: ConnectedButtonProfileProps) {
  return (
    <EpicsConnectedButtonProfile
      {...props}
      useAuthentication={useAuthenticationWithWalletSessionCleanup}
      useMe={useMe}
      resolvePostAuthRedirectPathOrDefault={
        resolvePostAuthRedirectPathOrDefault
      }
    />
  );
}
