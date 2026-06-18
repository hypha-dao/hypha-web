import {
  clearAuthReturnPath,
  consumeAuthReturnPath,
  peekAuthReturnPath,
} from '@hypha-platform/authentication';
import { getDhoSpaceContextPath } from './get-dho-space-context-path';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';

type ResolvePostAuthRedirectPathParams = {
  pathname: string;
  lang?: string;
  baseRedirectPath: string;
  consume?: boolean;
};

export function resolvePostAuthRedirectPath({
  pathname,
  lang,
  baseRedirectPath,
  consume = true,
}: ResolvePostAuthRedirectPathParams): string | null {
  const storedPath = consume ? consumeAuthReturnPath() : peekAuthReturnPath();
  if (!storedPath) {
    return null;
  }

  const spaceSlug = getDhoSpaceSlugFromPathname(storedPath);
  if (spaceSlug && lang) {
    return getDhoSpaceContextPath({
      pathname: storedPath,
      lang,
      spaceSlug,
    });
  }

  if (consume) {
    clearAuthReturnPath();
  }

  return storedPath;
}

export function resolvePostAuthRedirectPathOrDefault(
  params: ResolvePostAuthRedirectPathParams,
): string {
  const resolved = resolvePostAuthRedirectPath(params);
  if (resolved) {
    return resolved;
  }

  if (params.pathname.includes('/dho/')) {
    return params.pathname;
  }

  return params.baseRedirectPath;
}
