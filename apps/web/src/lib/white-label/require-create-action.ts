import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import {
  WL_AUTH_HEADER,
  WL_CREATE_ACTIONS_HEADER,
  WL_MODE_HEADER,
} from './constants';
import { authKindFor, readAuthConfigHeader } from './auth';
import { readCreateActionsHeader } from './headers';
import type { CreateAction } from './types';

/**
 * Server only (reads request headers): deliberately not exported from `./index`,
 * which stays pure for middleware and client code.
 *
 * A create page is served only on a host with login whose client enabled it
 * (same rule as the layout's capability); otherwise the white-label 404.
 * Fail closed: a missing or malformed header is "not enabled".
 */
export async function requireCreateAction(
  ...anyOf: CreateAction[]
): Promise<void> {
  const requestHeaders = await headers();
  const mode = requestHeaders.get(WL_MODE_HEADER) === 'host' ? 'host' : 'embed';
  const login =
    authKindFor(
      mode,
      readAuthConfigHeader(requestHeaders.get(WL_AUTH_HEADER)),
    ) === 'privy';
  const enabled = readCreateActionsHeader(
    requestHeaders.get(WL_CREATE_ACTIONS_HEADER),
  );
  if (!login || !anyOf.some((action) => enabled.includes(action))) notFound();
}
