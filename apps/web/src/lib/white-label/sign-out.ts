/**
 * A host reloads once the visitor has signed out. The main app's sign-out
 * navigates away, so every hook remounts; a host stays on the page, where a
 * mounted hook (`useJwt` keeps the last token) and its SWR cache would still
 * hold the previous member's token and private data, and a sign-in as another
 * member could briefly reuse them. A reload drops all of it.
 *
 * `previous` / `current` are `isAuthenticated`; `undefined` means "not known
 * yet" (loading), which never counts as a sign-out.
 */
export function shouldReloadAfterSignOut(
  previous: boolean | undefined,
  current: boolean | undefined,
): boolean {
  return previous === true && current === false;
}
