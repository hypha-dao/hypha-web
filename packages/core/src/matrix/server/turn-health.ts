type TurnServerWire = {
  uris?: string[];
  username?: string;
  password?: string;
  ttl?: number;
};

function iceUrlKind(url: string): 'stun' | 'turn' | 'turns' | 'unknown' {
  const u = url.trim().toLowerCase();
  if (u.startsWith('stun:') || u.startsWith('stuns:')) return 'stun';
  if (u.startsWith('turns:')) return 'turns';
  if (u.startsWith('turn:')) return 'turn';
  return 'unknown';
}

/** Privacy-safe summary of homeserver `/voip/turnServer` — no credentials returned. */
export function summarizeMatrixTurnHealth(data: TurnServerWire): {
  turnCredsOk: boolean;
  uriCount: number;
  hasTurnUdp: boolean;
  hasTurnTcp: boolean;
  hasTurns: boolean;
  hasStun: boolean;
  ttlSec: number | null;
  turnServerUnavailable: boolean;
} {
  const uris = Array.isArray(data.uris) ? data.uris : [];
  let hasTurnUdp = false;
  let hasTurnTcp = false;
  let hasTurns = false;
  let hasStun = false;

  for (const raw of uris) {
    const url = String(raw);
    const kind = iceUrlKind(url);
    if (kind === 'stun') hasStun = true;
    if (kind === 'turns') hasTurns = true;
    if (kind === 'turn') {
      if (/transport=tcp/i.test(url)) hasTurnTcp = true;
      else hasTurnUdp = true;
    }
  }

  const hasUsername = Boolean(data.username?.trim());
  const hasPassword = Boolean(data.password?.trim());
  const turnCredsOk =
    uris.length > 0 &&
    hasUsername &&
    hasPassword &&
    (hasTurnUdp || hasTurnTcp || hasTurns);
  const turnServerUnavailable = !turnCredsOk;

  return {
    turnCredsOk,
    uriCount: uris.length,
    hasTurnUdp,
    hasTurnTcp,
    hasTurns,
    hasStun,
    ttlSec: typeof data.ttl === 'number' ? data.ttl : null,
    turnServerUnavailable,
  };
}
