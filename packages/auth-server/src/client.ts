export {
  AUTH_SERVER_API_BASE_PATH,
  AUTH_SERVER_CONSENT_PATH,
  AUTH_SERVER_LOGIN_PATH,
  AUTH_SERVER_SCOPES,
  CONNECTED_APPS_DISCONNECT_PATH,
  CONNECTED_APPS_SPACES_PATH,
  SCOPES_REQUIRING_SPACES_READ,
} from './config';
export { MAX_SPACE_GRANTS } from './grants';
export { describeScope } from './scope-copy';
export { describeClient, type ClientCopyKey } from './client-copy';
export { AUTH_SERVER_LANG_COOKIE, resolveAuthLocale } from './locale';
export type { ScopeCopyKey } from './scope-copy';
export type { ClientKind } from './consent';
