import { db } from '@hypha-platform/storage-postgres';

import { verifyPrivyAuthToken } from '../../common/server/verify-privy-auth-token';
import { getDb } from '../../common/server/get-db';
import type { DatabaseInstance } from '../../common/server/types';
import type { Person } from '../types';
import { findPersonBySub, findSelf } from './queries';

/** Domain Person omits `sub`; /me needs the verified id for ownership checks. */
function withVerifiedSub(person: Person, userId: string): Person {
  return person.sub === userId ? person : { ...person, sub: userId };
}

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
    if (person) return withVerifiedSub(person, verified.userId);
  }

  try {
    const person = await findSelf({ db: getDb({ authToken }) });
    if (!person) return null;
    return verified.ok ? withVerifiedSub(person, verified.userId) : person;
  } catch (error) {
    console.error(
      '[resolvePersonFromAuthToken] findSelf fallback failed',
      error,
    );
    return null;
  }
}

/**
 * The signed-in member and the database their numeric id belongs to.
 * Privy `sub` on the service database is the same lookup the member MCP uses.
 * Falling back to `findSelf` keeps the authenticated connection, so a new
 * profile is not queried with another database's person id.
 */
export async function resolveMemberCaller(
  authToken: string | undefined,
): Promise<{ person: Person; db: DatabaseInstance } | null> {
  if (!authToken?.trim()) return null;

  const verified = await verifyPrivyAuthToken(authToken);
  if (verified.ok) {
    try {
      const person = await findPersonBySub({ sub: verified.userId }, { db });
      if (person?.id) {
        return { person: withVerifiedSub(person, verified.userId), db };
      }
    } catch (error) {
      console.error(
        '[resolveMemberCaller] service lookup failed',
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }

  try {
    const authDb = getDb({ authToken });
    const person = await findSelf({ db: authDb });
    if (!person?.id) return null;
    return {
      person: verified.ok ? withVerifiedSub(person, verified.userId) : person,
      db: authDb,
    };
  } catch (error) {
    console.error(
      '[resolveMemberCaller] findSelf fallback failed',
      error instanceof Error ? error.message : 'unknown',
    );
    return null;
  }
}
