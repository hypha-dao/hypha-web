import 'server-only';

import {
  ASSET_DEFAULT_MAX_BYTES,
  ASSET_MAX_BYTES_LIMIT,
} from '../../common/server/asset-content';
import type { SpaceContextSharedSourceResult } from './read-shared-source';
import {
  decodeSharedSourceBytes,
  filenameFromContentDisposition,
  isSharedSourceUrl,
} from './shared-source';

const FETCH_TIMEOUT_MS = 20_000;

export function parseMatrixContentUri(
  raw: string,
): { serverName: string; mediaId: string } | null {
  const match = /^mxc:\/\/([A-Za-z0-9.:[\]-]+)\/([A-Za-z0-9_-]+)$/.exec(
    raw.trim(),
  );
  if (!match?.[1] || !match[2]) return null;
  return { serverName: match[1], mediaId: match[2] };
}

async function readCapped(
  res: Response,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!res.body) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.byteLength > maxBytes ? null : bytes;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Read a file a member attached in a Space Context chat (`mxc://`) through the
 * homeserver. Only files attached in that room can be read.
 */
export async function readSpaceContextMatrixFile(
  {
    mxcUrl,
    filename,
    maxBytes = ASSET_DEFAULT_MAX_BYTES,
    sharedUrls,
    homeserver,
    accessToken,
  }: {
    mxcUrl: string;
    filename?: string | null;
    maxBytes?: number;
    sharedUrls: string[];
    homeserver: string;
    accessToken: string;
  },
  deps: { fetch?: typeof fetch } = {},
): Promise<SpaceContextSharedSourceResult> {
  const media = parseMatrixContentUri(mxcUrl);
  if (!media) {
    return { ok: false, error: 'Invalid file link', code: 'invalid_url' };
  }
  if (!isSharedSourceUrl(mxcUrl, sharedUrls)) {
    return {
      ok: false,
      error:
        'Only links and documents members shared in this section chat can be read',
      code: 'not_shared',
    };
  }
  const limit = Math.min(
    Math.max(1024, Math.floor(maxBytes)),
    ASSET_MAX_BYTES_LIMIT,
  );
  const doFetch = deps.fetch ?? fetch;
  const base = homeserver.trim().replace(/\/+$/, '');
  const path = `${encodeURIComponent(media.serverName)}/${encodeURIComponent(
    media.mediaId,
  )}`;
  // Authenticated media first; older homeservers only serve the legacy path.
  const candidates = [
    `${base}/_matrix/client/v1/media/download/${path}`,
    `${base}/_matrix/media/v3/download/${path}`,
  ];

  for (const [index, url] of candidates.entries()) {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not read file',
        code: 'fetch_failed',
      };
    }
    const isLast = index === candidates.length - 1;
    if (!res.ok) {
      if (!isLast && [400, 404, 405].includes(res.status)) continue;
      return {
        ok: false,
        error: `HTTP ${res.status} ${res.statusText ?? ''}`.trim(),
        code: 'fetch_failed',
      };
    }
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > limit) {
      return {
        ok: false,
        error: `File is larger than ${limit} bytes`,
        code: 'too_large',
      };
    }
    const bytes = await readCapped(res, limit);
    if (!bytes) {
      return {
        ok: false,
        error: `File is larger than ${limit} bytes`,
        code: 'too_large',
      };
    }
    const decoded = await decodeSharedSourceBytes({
      bytes,
      contentType: res.headers.get('content-type'),
      filename:
        filename?.trim() ||
        filenameFromContentDisposition(
          res.headers.get('content-disposition'),
        ) ||
        'attachment',
    });
    if (!decoded.ok) return decoded;
    return { ...decoded, url: mxcUrl, final_url: mxcUrl };
  }
  return { ok: false, error: 'Could not read file', code: 'fetch_failed' };
}
