export type SignalDeepLinkLookupResult =
  | {
      ok: true;
      signalSlug: string;
      signalTitle?: string;
      spaceSlug: string;
      roomId: string | null;
    }
  | { ok: false; reason: 'auth_not_ready' | 'not_found' | 'network' };

const NOT_FOUND_RETRY_DELAYS_MS = [400, 1200, 2500] as const;

const AUTH_RETRY_DELAYS_MS = [500, 1500, 4000] as const;

export async function resolveSignalDeepLinkWithRetry(input: {
  signalId: string;
  expectedSpaceSlug: string;
  getAuthToken: () => string | null | undefined;
  fetchSignal: (
    signalId: string,
    authToken: string | null,
  ) => Promise<Response>;
  maxAttempts?: number;
}): Promise<SignalDeepLinkLookupResult> {
  const maxAttempts = input.maxAttempts ?? AUTH_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = input.getAuthToken()?.trim() ?? null;
    if (!token) {
      if (attempt < AUTH_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, AUTH_RETRY_DELAYS_MS[attempt]);
        });
        continue;
      }
      return { ok: false, reason: 'auth_not_ready' };
    }

    try {
      const res = await input.fetchSignal(input.signalId, token);
      if (res.status === 404) {
        const canRetry404 =
          attempt < NOT_FOUND_RETRY_DELAYS_MS.length &&
          attempt < maxAttempts - 1;
        if (canRetry404) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, NOT_FOUND_RETRY_DELAYS_MS[attempt]);
          });
          continue;
        }
        return { ok: false, reason: 'not_found' };
      }
      if (!res.ok) {
        return { ok: false, reason: 'network' };
      }

      const data = (await res.json()) as {
        signalSlug?: string;
        signalTitle?: string;
        spaceSlug?: string;
        roomId?: string | null;
      };
      const resolvedSlug = data.signalSlug?.trim();
      const resolvedSpaceSlug = data.spaceSlug?.trim();
      const resolvedRoomId = data.roomId?.trim() || null;
      if (
        !resolvedSlug ||
        !resolvedSpaceSlug ||
        resolvedSpaceSlug !== input.expectedSpaceSlug.trim()
      ) {
        if (attempt < NOT_FOUND_RETRY_DELAYS_MS.length) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, NOT_FOUND_RETRY_DELAYS_MS[attempt]);
          });
          continue;
        }
        return { ok: false, reason: 'not_found' };
      }

      return {
        ok: true,
        signalSlug: resolvedSlug,
        signalTitle: data.signalTitle?.trim() || undefined,
        spaceSlug: resolvedSpaceSlug,
        roomId: resolvedRoomId,
      };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }

  const token = input.getAuthToken()?.trim() ?? null;
  return token
    ? { ok: false, reason: 'not_found' }
    : { ok: false, reason: 'auth_not_ready' };
}
