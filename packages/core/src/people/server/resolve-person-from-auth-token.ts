import { db } from '@hypha-platform/storage-postgres';

import { verifyPrivyAuthToken } from '../../common/server/verify-privy-auth-token';
import { getDb } from '../../common/server/get-db';
import type { Person } from '../types';
import { findPersonBySub, findSelf } from './queries';

/**
 * Resolve the signed-in person for server auth gates.
 * Prefer Privy-verified sub + service DB (avoids Neon RLS failures on chat/tools),
 * then fall back to RLS `findSelf` when needed.
 */
export async function resolvePersonFromAuthToken(
  authToken: string | undefined,
): Promise<Person | null> {
  if (!authToken?.trim()) return null;

  const verified = await verifyPrivyAuthToken(authToken);
  if (verified.ok) {
    const person = await findPersonBySub({ sub: verified.userId }, { db });
    if (person) return person;
  }

  try {
    return await findSelf({ db: getDb({ authToken }) });
  } catch (error) {
    console.error(
      '[resolvePersonFromAuthToken] findSelf fallback failed',
      error,
    );
    return null;
  }
}
