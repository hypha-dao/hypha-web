/**
 * Privacy rule for every `/api/v2` response (binding, present and future):
 * a v2 response never contains sensitive personal data (`email`, `sub`,
 * banking/KYC data, `preferredCurrency`, or any other private `people`
 * column). A person object is built from an explicit ALLOWLIST (default deny:
 * a new column is not exposed until someone adds it here), never from a DB row
 * or by spreading one. Only a person reading their own data (planned
 * `/v2/people/me`) is exempt, on its own route with its own gate.
 */

/** Public-profile fields a v2 person object may carry, at most. */
export const PUBLIC_PERSON_FIELDS = [
  'slug',
  'name',
  'surname',
  'nickname',
  'avatarUrl',
] as const;

export function pickPublicPerson<T extends Record<string, unknown>>(
  person: T,
): Partial<Pick<T, Extract<(typeof PUBLIC_PERSON_FIELDS)[number], keyof T>>> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_PERSON_FIELDS) {
    if (key in person && person[key] !== undefined) out[key] = person[key];
  }
  return out as never;
}

/**
 * Document creators are the v1 `creator` object (person or space). v2 keeps
 * the display fields and `type` and omits `address` (an intentional,
 * documented exception to "v2 is a superset of v1").
 */
export const PUBLIC_CREATOR_FIELDS = [
  'avatarUrl',
  'name',
  'surname',
  'type',
] as const;

export function toPublicCreator<T extends Record<string, unknown>>(
  creator: T | undefined,
): Partial<T> | undefined {
  if (!creator) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_CREATOR_FIELDS) {
    if (key in creator && creator[key] !== undefined) out[key] = creator[key];
  }
  return out as Partial<T>;
}

/**
 * The only fields v2 intentionally omits from a v1 item, by route. The
 * v1 ⊆ v2 contract tests exempt exactly these, by name (K12 amendment:
 * superset except explicitly listed omissions).
 */
export const V2_EXPLICIT_OMISSIONS = {
  spacesListItem: ['memberAddresses'],
  spaceDetail: ['memberAddresses'],
  documentCreator: ['address'],
} as const;

/** Keys that must never appear anywhere in a v2 response (contract test). */
export const V2_RESPONSE_DENYLIST = [
  'email',
  'sub',
  'preferredCurrency',
  'memberAddresses',
] as const;
