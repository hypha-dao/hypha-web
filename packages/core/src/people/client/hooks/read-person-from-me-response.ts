import type { Person } from '../../types';

/**
 * GET /me returns 404 when Privy auth succeeded but no `people` row exists yet.
 * That is the new-user signup path — not a fetch failure.
 *
 * Other non-OK statuses must not be parsed as a Person (a 500 `{ error }` body
 * used to be cached as a profile and wiped `slug`).
 */
export async function readPersonFromMeResponse(
  res: Response,
): Promise<Person | null> {
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch profile: ${res.status}`);
  }
  // JSON dates stay ISO strings; callers already treat Person dates as optional display values.
  return (await res.json()) as Person;
}
