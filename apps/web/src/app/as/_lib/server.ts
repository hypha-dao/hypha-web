import 'server-only';
import {
  createAuthServer,
  createAuthServerHandler,
  loadAuthServerConfig,
  type AuthServer,
  type AuthServerConfig,
  type AuthServerDisabled,
} from '@hypha-platform/auth-server/server';

/**
 * The one place that wires the authorization server into the app. Configuration is read once
 * per server instance; the server (database pool, keys) is built lazily, only for a request that
 * reached the right host on an allowed path.
 */
let config: AuthServerConfig | AuthServerDisabled | undefined;
let server: AuthServer | undefined;

export function getAuthServerConfig(): AuthServerConfig | AuthServerDisabled {
  return (config ??= loadAuthServerConfig());
}

export function getAuthServer(cfg: AuthServerConfig): AuthServer {
  return (server ??= createAuthServer(cfg));
}

export const handleAuthServerRequest = createAuthServerHandler(
  getAuthServerConfig,
  getAuthServer,
);
