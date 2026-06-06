/**
 * Optional CSP `connect-src` entries for Matrix TURN/STUN when the relay host
 * differs from `NEXT_PUBLIC_MATRIX_HOMESERVER_URL`. WebRTC media mostly bypasses
 * CSP; this covers fetches and future strict policies. See
 * docs/requirements/matrix-voip-turn-server-setup.md.
 */

export function matrixTurnConnectSourcesFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const raw = env.NEXT_PUBLIC_MATRIX_TURN_CONNECT_SOURCES?.trim();
  if (!raw) return [];
  return raw
    .split(/,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
