/**
 * Classifies Matrix GroupCall / getUserMedia failures for UI (permission vs other).
 * @public
 */
export function isPermissionLikeGroupCallError(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = String((e as { code?: string }).code);
    if (code === 'no_user_media') return true;
  }
  if (e instanceof Error) {
    const name = e.name;
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDismissedError' /* experimental */ ||
      name === 'SecurityError' ||
      name === 'NotReadableError' ||
      name === 'OverconstrainedError'
    ) {
      return true;
    }
    const m = e.message.toLowerCase();
    return (
      m.includes('notallowederror') ||
      m.includes('permission') ||
      m.includes('not allowed')
    );
  }
  return false;
}
