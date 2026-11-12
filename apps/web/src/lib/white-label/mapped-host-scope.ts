import type { DbConfig } from '@hypha-platform/core/server';
import { WL_SPACE_HEADER } from './constants';

/**
 * Server only (reads the database): deliberately not exported from `./index`,
 * which stays pure for middleware and client code.
 *
 * A request on a mapped host reaches `/api` with the Space header set by
 * middleware (never by the caller: inbound copies are dropped). A few
 * public-data routes answer there for that Space only; this is how they
 * find out. A request without the header is the main app: the route runs
 * exactly as before.
 */
export type MappedHostScope =
  | { kind: 'main' }
  | {
      kind: 'mapped';
      slug: string;
      /** `spaces.id` (database). */
      spaceId: number;
      /** On-chain id; null for a Space without one. */
      web3SpaceId: number | null;
    }
  /** Header present but the Space is unknown: the route answers 404. */
  | { kind: 'unknown-space' };

type SpaceIds = { spaceId: number; web3SpaceId: number | null };

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: SpaceIds; expires: number }>();

/** Test hook. */
export function resetMappedHostScopeCache(): void {
  cache.clear();
}

/**
 * Only a found Space is cached (briefly). An unknown slug is not, so a Space
 * created after a miss is picked up at once; it costs one indexed lookup per
 * call, for a slug that came from the host config.
 */
export async function resolveMappedHostScope(
  request: Pick<Request, 'headers'>,
  { db }: DbConfig,
  now: () => number = Date.now,
): Promise<MappedHostScope> {
  const slug = request.headers.get(WL_SPACE_HEADER)?.trim();
  if (!slug) return { kind: 'main' };

  const hit = cache.get(slug);
  if (hit && hit.expires > now()) {
    return { kind: 'mapped', slug, ...hit.value };
  }

  // A lookup error propagates (the route answers 500); it is never read as "main".
  const row = await db.query.spaces.findFirst({
    columns: { id: true, web3SpaceId: true },
    where: (spaces, { eq }) => eq(spaces.slug, slug),
  });
  if (!row) return { kind: 'unknown-space' };

  const ids: SpaceIds = { spaceId: row.id, web3SpaceId: row.web3SpaceId };
  cache.set(slug, { value: ids, expires: now() + CACHE_TTL_MS });
  return { kind: 'mapped', slug, ...ids };
}

/**
 * The Space and proposal id of one document row, by database id or by slug.
 * Null when the document does not exist or has no Space: the caller answers
 * 404. A caller that goes on to read the proposal uses this same row, so the
 * Space check and the read cannot resolve different documents.
 */
export async function findDocumentSpace(
  key: { id: number } | { slug: string },
  { db }: DbConfig,
): Promise<{ spaceId: number; web3ProposalId: number | null } | null> {
  const row = await db.query.documents.findFirst({
    columns: { spaceId: true, web3ProposalId: true },
    where: (documents, { eq }) =>
      'id' in key ? eq(documents.id, key.id) : eq(documents.slug, key.slug),
  });
  if (!row || row.spaceId === null) return null;
  return { spaceId: row.spaceId, web3ProposalId: row.web3ProposalId };
}
