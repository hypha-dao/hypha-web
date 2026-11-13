'use client';

import React from 'react';
import { ReadOnlyEvmProvider } from '@hypha-platform/evm';

/** True under `AnonymousAuthProvider`; read by `useAuthentication`. */
export const AnonymousAuthContext = React.createContext(false);

/**
 * For trees without login (white-label, read-only). Mounts no Privy: the
 * visitor is always signed out and wagmi is read-only.
 */
export const AnonymousAuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <AnonymousAuthContext.Provider value={true}>
    <ReadOnlyEvmProvider>{children}</ReadOnlyEvmProvider>
  </AnonymousAuthContext.Provider>
);

const noop = (): void => undefined;
const asyncNoop = async (): Promise<void> => undefined;
const noToken = async (): Promise<string | null> => null;

/** Signed-out state with the same shape as the Privy-backed hook. */
export function useAnonymousAuthentication() {
  const [isLoggingIn, setLoggingIn] = React.useState(false);
  return React.useMemo(
    () => ({
      // Read-only tree: nobody can sign in, so UI that only makes sense for a
      // signed-in visitor (account prompts, write actions) hides itself.
      canLogin: false,
      isAuthenticated: false,
      isLoading: false,
      isEmbeddedWallet: false,
      user: null,
      // Read-only tree: there is nothing to sign in to.
      login: asyncNoop,
      openLoginModal: noop,
      logout: async (_redirect: boolean = true): Promise<void> => undefined,
      isLoggingIn,
      setLoggingIn,
      getAccessToken: noToken,
      exportWallet: asyncNoop,
      isModalOpen: false,
    }),
    [isLoggingIn],
  );
}
