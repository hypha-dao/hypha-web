'use client';

export type ResolvedSignalThreadTarget = {
  signalSlug: string;
  signalTitle: string;
  spaceSlug: string;
  roomId: string;
};

const SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX = 'hypha-room-to-coherence-slug-';
const SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX = 'hypha-room-to-coherence-title-';
const SESSION_ROOM_TO_COHERENCE_SPACE_PREFIX = 'hypha-room-to-coherence-space-';
const COHERENCE_ROOM_REVERSE_PREFIX = 'hypha-room-id-to-coherence-';

/** Read cached signal thread metadata without hitting the network. */
export function readLocalSignalThreadTarget(
  roomId: string,
): ResolvedSignalThreadTarget | null {
  return readLocalSignalThreadTargetFromStorage(roomId);
}

function readLocalSignalThreadTargetFromStorage(
  roomId: string,
): ResolvedSignalThreadTarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const slug = window.sessionStorage
      .getItem(`${SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX}${roomId}`)
      ?.trim();
    const title =
      window.sessionStorage
        .getItem(`${SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX}${roomId}`)
        ?.trim() ?? '';
    const spaceSlug =
      window.sessionStorage
        .getItem(`${SESSION_ROOM_TO_COHERENCE_SPACE_PREFIX}${roomId}`)
        ?.trim() ?? '';
    if (slug && spaceSlug) {
      return {
        signalSlug: slug,
        signalTitle: title || slug,
        spaceSlug,
        roomId,
      };
    }

    const persisted = window.localStorage
      .getItem(`${COHERENCE_ROOM_REVERSE_PREFIX}${roomId}`)
      ?.trim();
    if (!persisted) return null;
    const parsed = JSON.parse(persisted) as {
      slug?: string;
      title?: string | null;
      spaceSlug?: string | null;
    };
    const persistedSlug = parsed.slug?.trim();
    const persistedSpaceSlug = parsed.spaceSlug?.trim();
    if (!persistedSlug || !persistedSpaceSlug) return null;
    return {
      signalSlug: persistedSlug,
      signalTitle: parsed.title?.trim() || persistedSlug,
      spaceSlug: persistedSpaceSlug,
      roomId,
    };
  } catch {
    return null;
  }
}

/** Persist room→signal mapping so later mention opens skip the network. */
export function rememberLocalSignalThreadTarget(
  target: ResolvedSignalThreadTarget,
): void {
  if (typeof window === 'undefined') return;
  const roomId = target.roomId.trim();
  const signalSlug = target.signalSlug.trim();
  const spaceSlug = target.spaceSlug.trim();
  if (!roomId || !signalSlug || !spaceSlug) return;
  try {
    window.sessionStorage.setItem(
      `${SESSION_ROOM_TO_COHERENCE_SLUG_PREFIX}${roomId}`,
      signalSlug,
    );
    const title = target.signalTitle.trim() || signalSlug;
    window.sessionStorage.setItem(
      `${SESSION_ROOM_TO_COHERENCE_TITLE_PREFIX}${roomId}`,
      title,
    );
    window.sessionStorage.setItem(
      `${SESSION_ROOM_TO_COHERENCE_SPACE_PREFIX}${roomId}`,
      spaceSlug,
    );
    window.localStorage.setItem(
      `${COHERENCE_ROOM_REVERSE_PREFIX}${roomId}`,
      JSON.stringify({
        slug: signalSlug,
        title,
        spaceSlug,
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Resolve a Matrix room id to a signal thread (local cache first, then API).
 *
 * Aggregated Mentions can reference signal rooms the user has never opened via
 * Hypha UI, so there may be no session/local reverse map. Always fall through
 * to `/api/v1/matrix/rooms/:roomId/signal` on cache miss.
 */
export async function resolveSignalThreadByMatrixRoom(
  roomId: string,
  getAccessToken?: () => Promise<string | null | undefined>,
): Promise<ResolvedSignalThreadTarget | null> {
  const trimmed = roomId.trim();
  if (!trimmed) return null;

  const cached = readLocalSignalThreadTargetFromStorage(trimmed);
  if (cached) return cached;

  const headers: HeadersInit = {};
  try {
    const token = getAccessToken ? await getAccessToken() : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `/api/v1/matrix/rooms/${encodeURIComponent(trimmed)}/signal`,
      { headers },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      signalSlug?: string;
      signalTitle?: string;
      spaceSlug?: string;
      roomId?: string;
    };
    const signalSlug = data.signalSlug?.trim();
    const spaceSlug = data.spaceSlug?.trim();
    if (!signalSlug || !spaceSlug) return null;

    const resolved: ResolvedSignalThreadTarget = {
      signalSlug,
      signalTitle: data.signalTitle?.trim() || signalSlug,
      spaceSlug,
      roomId: data.roomId?.trim() || trimmed,
    };
    rememberLocalSignalThreadTarget(resolved);
    return resolved;
  } catch (error) {
    console.warn('[resolveSignalThreadByMatrixRoom] lookup failed:', error);
    return null;
  }
}
