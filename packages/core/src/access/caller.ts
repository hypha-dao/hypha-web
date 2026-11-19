import type { findPersonBySub } from '../people/server/queries';

type Person = NonNullable<Awaited<ReturnType<typeof findPersonBySub>>>;

/**
 * How a caller arrived through the authorization server. Absent for callers that came by
 * another route (the API's Privy bearer). Additive: nothing that reads a `Caller` without
 * it changes behaviour.
 */
export type CallerVia = {
  /** The OAuth client the person approved (a metadata-document URL or a registered id). */
  clientId: string | null;
  scopes: string[];
  /**
   * Spaces the person granted to this client, as DB space ids. `null` = every space the
   * person can see (no per-space restriction). An empty array grants nothing.
   */
  spaceGrants: number[] | null;
};

/**
 * Who is asking. `guest` exists for the API only; the MCP never produces one.
 */
export type Caller =
  | { kind: 'guest' }
  | {
      kind: 'user';
      person: Person;
      address: `0x${string}` | null;
      via?: CallerVia;
    };
