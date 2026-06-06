type IceUrlKind = 'stun' | 'turn' | 'turns' | 'unknown';

function iceUrlKind(url: string): IceUrlKind {
  const u = url.trim().toLowerCase();
  if (u.startsWith('stun:') || u.startsWith('stuns:')) return 'stun';
  if (u.startsWith('turns:')) return 'turns';
  if (u.startsWith('turn:')) return 'turn';
  return 'unknown';
}

/** One object per RTCPeerConnection `iceServers` entry — no secrets. */
export function summarizeMatrixIceServers(raw: RTCIceServer[] | undefined): {
  /** Count of `iceServers` objects. */
  entryCount: number;
  /** Total URL strings across all entries. */
  urlCount: number;
  hasStun: boolean;
  hasTurn: boolean;
  hasTurns: boolean;
  /** Sample of hostname-like segments (first label of host), not full URLs. */
  hostHints: string[];
} {
  if (!raw?.length) {
    return {
      entryCount: 0,
      urlCount: 0,
      hasStun: false,
      hasTurn: false,
      hasTurns: false,
      hostHints: [],
    };
  }
  let urlCount = 0;
  let hasStun = false;
  let hasTurn = false;
  let hasTurns = false;
  const hostHints: string[] = [];

  for (const e of raw) {
    const urls = Array.isArray(e.urls) ? e.urls : e.urls ? [e.urls] : [];
    urlCount += urls.length;
    for (const url of urls) {
      const k = iceUrlKind(String(url));
      if (k === 'stun') hasStun = true;
      if (k === 'turn') hasTurn = true;
      if (k === 'turns') hasTurns = true;
      try {
        const u = new URL(
          String(url)
            .replace(/^stun[s]?:/i, 'https:')
            .replace(/^turn[s]?:/i, 'https:'),
        );
        const h = u.hostname.split('.')[0];
        if (h && !hostHints.includes(h) && hostHints.length < 6) {
          hostHints.push(h);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return {
    entryCount: raw.length,
    urlCount,
    hasStun,
    hasTurn,
    hasTurns,
    hostHints,
  };
}
