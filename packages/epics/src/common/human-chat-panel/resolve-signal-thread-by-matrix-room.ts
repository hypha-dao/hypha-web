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

function readLocalSignalThreadTarget(
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

/** Resolve a Matrix room id to a signal thread (local cache first, then API). */
export async function resolveSignalThreadByMatrixRoom(
  roomId: string,
  getAccessToken?: () => Promise<string | null | undefined>,
): Promise<ResolvedSignalThreadTarget | null> {
  const trimmed = roomId.trim();
  if (!trimmed) return null;

  const cached = readLocalSignalThreadTarget(trimmed);
  if (cached) return cached;

  const headers: HeadersInit = {};
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

  return {
    signalSlug,
    signalTitle: data.signalTitle?.trim() || signalSlug,
    spaceSlug,
    roomId: data.roomId?.trim() || trimmed,
  };
}
