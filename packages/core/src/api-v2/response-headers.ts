/**
 * v2 responses depend on who asks (the viewer-aware list, the access gate and
 * every `my-*` route), so they are `private` and vary on both credential
 * headers: a shared cache must never serve one caller's body to another.
 */
export const V2_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization, x-hypha-client-key',
} as const;
