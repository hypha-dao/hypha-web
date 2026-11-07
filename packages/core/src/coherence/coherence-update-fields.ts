import { UpdateCoherenceInput } from './types';

/**
 * Runtime allowlist for `updateCoherenceBySlug`.
 * TypeScript drops extra keys only at compile time. A server-action payload
 * can still carry `spaceId`, `creatorId`, or other columns. Only these four
 * declared fields are written, and only when the caller sent them.
 */
const COHERENCE_UPDATE_KEYS = [
  'archived',
  'roomId',
  'messages',
  'views',
] as const satisfies readonly (keyof UpdateCoherenceInput)[];

export function pickCoherenceUpdateFields(input: object): UpdateCoherenceInput {
  const source = input as Record<string, unknown>;
  const picked: UpdateCoherenceInput = {};
  for (const key of COHERENCE_UPDATE_KEYS) {
    if (source[key] !== undefined) {
      picked[key] = source[key] as never;
    }
  }
  return picked;
}
