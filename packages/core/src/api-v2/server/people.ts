import 'server-only';

import type { V2Caller, V2Failure } from './access';

/**
 * `?include=` blocks of `GET /api/v2/people/me`. `address` (the wallet) is opt-in: it is never
 * part of the default answer.
 */
export const PEOPLE_ME_INCLUDE_BLOCKS = ['address'] as const;
export type PeopleMeIncludeBlock = (typeof PEOPLE_ME_INCLUDE_BLOCKS)[number];

export type MyProfileV2 = {
  name: string | null;
  surname: string | null;
  slug: string | null;
  avatarUrl: string | null;
  /** Only with `include=address`. */
  address?: string | null;
};

/**
 * The caller's own minimal profile. Built from an explicit allowlist, never from the person row
 * (privacy rule of `public-profile.ts`): no email, no `sub`, no internal id. The route that
 * calls this is the one documented exception to "no wallet address", and only on request.
 */
export function buildMyProfileV2({
  caller,
  includeAddress,
}: {
  caller: V2Caller;
  includeAddress: boolean;
}): { ok: true; body: MyProfileV2 } | V2Failure {
  if (caller.kind !== 'user') {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  const { person } = caller;
  const body: MyProfileV2 = {
    name: person.name ?? null,
    surname: person.surname ?? null,
    slug: person.slug ?? null,
    avatarUrl: person.avatarUrl ?? null,
  };
  if (includeAddress) body.address = caller.address ?? null;
  return { ok: true, body };
}
