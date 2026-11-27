import 'server-only';

import { findPersonBySub } from '../data-access/people';
import type { ServiceActor } from '../data-access/types';
import type { Caller } from './caller';
import { failure, type Failure } from './failure';

/**
 * Claims of an access token that the authorization server issued and the resource guard
 * already verified (signature, issuer, audience, expiry, whitelist, scope). A union, so a
 * `client` kind (a client acting on its own, E53) can be added without touching callers.
 */
export type VerifiedClaims = {
  kind: 'user';
  /** The person: the token `sub`, which is `people.sub`. */
  sub: string;
  clientId: string | null;
  scopes: string[];
  /** DB space ids the person granted to this client; null/undefined = no restriction. */
  spaceGrants?: number[] | null;
  /** The client's self-declared name (`client_name` claim); unverified. */
  clientName?: string | null;
};

/**
 * The one place a token subject becomes a person. Moving from `people.sub` to another
 * person reference later is a change in this function only.
 */
/** No person is known yet: the lookup runs as the identity service. */
const IDENTITY: ServiceActor = { kind: 'service', name: 'identity' };

async function findPersonForClaims(claims: VerifiedClaims) {
  return findPersonBySub({ actor: IDENTITY }, { sub: claims.sub });
}

/**
 * Build the `Caller` from verified claims. There is no Privy bearer in this layer and it
 * never produces a guest. A person without a Hypha profile is a typed failure (a clear
 * tool error), not a guest.
 */
export async function resolveCaller(claims: VerifiedClaims): Promise<
  | {
      ok: true;
      caller: Extract<Caller, { kind: 'user' }> & {
        via: NonNullable<Extract<Caller, { kind: 'user' }>['via']>;
      };
    }
  | Failure
> {
  const person = await findPersonForClaims(claims);
  if (!person) {
    return failure(
      'no_profile',
      'No Hypha profile exists for this account. Create one in Hypha first.',
    );
  }
  return {
    ok: true,
    caller: {
      kind: 'user',
      person,
      address: (person.address as `0x${string}` | null | undefined) ?? null,
      via: {
        clientId: claims.clientId,
        scopes: [...claims.scopes],
        spaceGrants: claims.spaceGrants ?? null,
        clientName: claims.clientName ?? null,
      },
    },
  };
}
