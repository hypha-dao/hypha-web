import type { ComponentType, ReactNode } from 'react';
import {
  AnonymousAuthProvider,
  AuthProvider,
} from '@hypha-platform/authentication';
import {
  authKindFor,
  type WhiteLabelAuthConfig,
  type WhiteLabelMode,
} from '@web/lib/white-label';

export type WhiteLabelAuthProps = {
  /**
   * The host's login settings, read per request by the root layout (never a
   * `NEXT_PUBLIC_*` build value). `null` in the iframe and on a host with none.
   */
  authConfig: WhiteLabelAuthConfig | null;
  children: ReactNode;
};

/** Iframe delivery: read-only, the visitor is always signed out. */
function EmbedAuth({ children }: WhiteLabelAuthProps) {
  return <AnonymousAuthProvider>{children}</AnonymousAuthProvider>;
}

/**
 * Host delivery. With the host's login settings, the same Privy provider as the
 * main app, on the host's own app client: the client id is a server value
 * (read per request from the host config) handed to the client provider as a
 * prop, never a `NEXT_PUBLIC_*` build value, so one deployment serves every
 * host. The cookie domain is a setting of that client in Privy; the layout and
 * middleware use `authConfig.cookieDomain` for the CSP. A host without login
 * settings stays signed out and read-only.
 */
function HostAuth({ authConfig, children }: WhiteLabelAuthProps) {
  if (authKindFor('host', authConfig) === 'anonymous' || !authConfig) {
    return <AnonymousAuthProvider>{children}</AnonymousAuthProvider>;
  }
  return (
    <AuthProvider
      config={{
        appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        clientId: authConfig.privyClientId,
      }}
    >
      {children}
    </AuthProvider>
  );
}

const AUTH_BY_MODE: Record<
  WhiteLabelMode,
  ComponentType<WhiteLabelAuthProps>
> = {
  embed: EmbedAuth,
  host: HostAuth,
};

/** The auth provider of a white-label tree, chosen by the resolved mode. */
export function WhiteLabelAuthProvider({
  mode,
  authConfig,
  children,
}: WhiteLabelAuthProps & { mode: WhiteLabelMode }) {
  const Provider = AUTH_BY_MODE[mode];
  return <Provider authConfig={authConfig}>{children}</Provider>;
}
