/** Result of checking an existing aliased room against a required type. */
export type RequiredRoomTypeLookup = 'match' | 'mismatch' | 'unknown';

/**
 * Whether the existing alias may be reused, detached, or left untouched.
 * `unknown` is a failed lookup — never detach or delete the alias.
 */
export type AliasedRoomTypeAction = 'keep' | 'detach' | 'abort';

export function classifyRequiredRoomType(
  actualType: string | null | undefined,
  requiredType: string,
): Exclude<RequiredRoomTypeLookup, 'unknown'> {
  return actualType === requiredType ? 'match' : 'mismatch';
}

/**
 * Read a room type. A thrown lookup is `unknown` so callers can stop
 * without touching the alias.
 */
export async function lookupRequiredRoomType(
  getType: () => Promise<string | null | undefined>,
  requiredType: string,
  onError?: (error: unknown) => void,
): Promise<RequiredRoomTypeLookup> {
  try {
    return classifyRequiredRoomType(await getType(), requiredType);
  } catch (error) {
    onError?.(error);
    return 'unknown';
  }
}

/**
 * Detach only after a successful lookup confirms the wrong type (or the
 * alias is the member room). A thrown / failed lookup must abort.
 */
export function actionForRequiredRoomTypeLookup(
  lookup: RequiredRoomTypeLookup,
  isMemberRoom = false,
): AliasedRoomTypeAction {
  if (lookup === 'unknown') return 'abort';
  if (isMemberRoom || lookup === 'mismatch') return 'detach';
  return 'keep';
}
