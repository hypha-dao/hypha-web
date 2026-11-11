import type { ComponentType, ReactNode } from 'react';
import { AnonymousAuthProvider } from '@hypha-platform/authentication';
import type {
  WhiteLabelAuthConfig,
  WhiteLabelMode,
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
 * Host delivery. Signed out for now: the Privy provider for the host's client
 * (`authConfig.privyClientId`, a server value handed to a client provider as a
 * prop) replaces this body in the login PR, and nothing else in the layout
 * changes.
 */
function HostAuth({ children }: WhiteLabelAuthProps) {
  return <AnonymousAuthProvider>{children}</AnonymousAuthProvider>;
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
