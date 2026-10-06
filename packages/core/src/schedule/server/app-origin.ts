import 'server-only';
import { getAppBaseUrl } from '../../common/server/get-app-url';

export function resolveAppOrigin(): string {
  return getAppBaseUrl();
}

export function toAbsoluteAppUrl(path: string): string {
  return `${resolveAppOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}
