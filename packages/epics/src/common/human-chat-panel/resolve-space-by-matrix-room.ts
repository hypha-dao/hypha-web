'use client';

export type ResolvedSpaceTarget = {
  spaceSlug: string;
  spaceTitle: string;
  roomId: string;
};

/** Resolve a Matrix room id (a space's general chat room) to its space. */
export async function resolveSpaceByMatrixRoom(
  roomId: string,
  getAccessToken?: () => Promise<string | null | undefined>,
): Promise<ResolvedSpaceTarget | null> {
  const trimmed = roomId.trim();
  if (!trimmed) return null;

  const headers: HeadersInit = {};
  try {
    const token = getAccessToken ? await getAccessToken() : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `/api/v1/matrix/rooms/${encodeURIComponent(trimmed)}/space`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      spaceSlug?: string;
      spaceTitle?: string;
      roomId?: string;
    };
    const spaceSlug = data.spaceSlug?.trim();
    if (!spaceSlug) return null;

    return {
      spaceSlug,
      spaceTitle: data.spaceTitle?.trim() || spaceSlug,
      roomId: data.roomId?.trim() || trimmed,
    };
  } catch (error) {
    console.warn('[resolveSpaceByMatrixRoom] lookup failed:', error);
    return null;
  }
}
