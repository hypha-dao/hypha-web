'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';

import {
  resolveMemberExperience,
  writeOrientationCookie,
  type KnownOrientation,
} from './member-orientation-cookie';

const RememberedOrientationContext = createContext<KnownOrientation | null>(
  null,
);

export function RememberedOrientationProvider({
  value,
  children,
}: {
  value: KnownOrientation | null;
  children: ReactNode;
}) {
  return (
    <RememberedOrientationContext.Provider value={value}>
      {children}
    </RememberedOrientationContext.Provider>
  );
}

/** Writes the cookie after the profile settles, and clears it on sign-out. */
export function RememberOrientation() {
  const { person, isLoading } = useMe();
  const { isAuthenticated, isLoading: authLoading } = useAuthentication();

  useEffect(() => {
    if (authLoading || isLoading) return;
    if (!isAuthenticated) {
      writeOrientationCookie(null);
      return;
    }
    writeOrientationCookie(person?.primaryOrientation);
  }, [authLoading, isAuthenticated, isLoading, person?.primaryOrientation]);

  return null;
}

/**
 * Member chrome for a known member, including the first paint of a reload.
 * Unknown visitors and anyone still loading without a remembered persona
 * stay on the full menu.
 */
export function useMemberExperience() {
  const remembered = useContext(RememberedOrientationContext);
  const { person, isLoading } = useMe();
  return resolveMemberExperience({
    liveSettled: !isLoading || person != null,
    liveOrientation: person?.primaryOrientation,
    remembered,
  });
}
