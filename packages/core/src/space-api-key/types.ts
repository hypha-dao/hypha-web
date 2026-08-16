export const SPACE_API_KEY_SCOPES = [
  'signals:write',
  'signals:upvote',
  'intelligence:read',
  'intelligence:write',
] as const;

export type SpaceApiKeyScope = (typeof SPACE_API_KEY_SCOPES)[number];

/** `intelligence:write` implies `intelligence:read`. Signal scopes stay exact. */
export function spaceApiKeySatisfiesScope(
  scopes: readonly string[],
  required: SpaceApiKeyScope,
): boolean {
  if (scopes.includes(required)) return true;
  return (
    required === 'intelligence:read' && scopes.includes('intelligence:write')
  );
}

/** Key metadata safe to return over the wire — never includes the digest. */
export type SpaceApiKeySummary = {
  id: number;
  spaceId: number;
  name: string;
  source: string;
  keyPrefix: string;
  scopes: SpaceApiKeyScope[];
  createdByPersonId: number | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export function isSpaceApiKeyScope(value: string): value is SpaceApiKeyScope {
  return (SPACE_API_KEY_SCOPES as readonly string[]).includes(value);
}
