import 'server-only';

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

import {
  ASSET_DEFAULT_MAX_BYTES,
  ASSET_MAX_BYTES_LIMIT,
} from '../../common/server/asset-content';
import {
  decodeSharedSourceBytes,
  filenameFromContentDisposition,
  isBlockedIpAddress,
  isSharedSourceUrl,
  parseSharedSourceUrl,
  type SpaceContextSharedSourceContent,
  type SpaceContextSharedSourceFailure,
} from './shared-source';

const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'HyphaAI/1.0 (+https://hypha.earth; space context reader)';

export type SpaceContextSharedSourceSuccess = {
  ok: true;
  url: string;
  final_url: string;
} & SpaceContextSharedSourceContent;

export type SpaceContextSharedSourceResult =
  | SpaceContextSharedSourceSuccess
  | SpaceContextSharedSourceFailure;

type FetchOnceResult =
  | {
      kind: 'body';
      bytes: Uint8Array;
      headers: IncomingHttpHeaders;
    }
  | { kind: 'redirect'; location: string | null }
  | SpaceContextSharedSourceFailure;

export type SharedSourceFetchOnce = (
  url: URL,
  maxBytes: number,
  timeoutMs: number,
) => Promise<FetchOnceResult>;

/**
 * Resolve DNS ourselves and refuse non-public answers, so the socket can only
 * connect to an address we validated (no DNS rebinding between check and use).
 */
const guardedLookup: NonNullable<RequestOptions['lookup']> = (
  hostname,
  options,
  callback,
) => {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) {
      callback(err, '', 0);
      return;
    }
    const family = options.family === 4 || options.family === 6;
    const list = (addresses as LookupAddress[]).filter(
      (entry) => !family || entry.family === options.family,
    );
    if (
      list.length === 0 ||
      list.some((entry) => isBlockedIpAddress(entry.address))
    ) {
      const blocked: NodeJS.ErrnoException = new Error(
        'This address is not reachable from Hypha',
      );
      blocked.code = 'EHYPHA_BLOCKED';
      callback(blocked, '', 0);
      return;
    }
    if (options.all) {
      callback(null, list);
      return;
    }
    const first = list[0] as LookupAddress;
    callback(null, first.address, first.family);
  });
};

function decompress(
  bytes: Buffer,
  encoding: string | undefined,
  maxBytes: number,
): Buffer {
  const enc = encoding?.trim().toLowerCase();
  if (!enc || enc === 'identity') return bytes;
  const opts = { maxOutputLength: maxBytes };
  if (enc === 'gzip' || enc === 'x-gzip') return gunzipSync(bytes, opts);
  if (enc === 'deflate') return inflateSync(bytes, opts);
  if (enc === 'br') return brotliDecompressSync(bytes, opts);
  throw new Error(`Unsupported content encoding ${enc}`);
}

const fetchOnce: SharedSourceFetchOnce = (url, maxBytes, timeoutMs) =>
  new Promise((resolve) => {
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const settle = (result: FetchOnceResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    const req = httpsRequest(
      url,
      {
        method: 'GET',
        lookup: guardedLookup,
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,text/plain,text/markdown,application/pdf,image/*,*/*;q=0.5',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          settle({
            kind: 'redirect',
            location:
              typeof res.headers.location === 'string'
                ? res.headers.location
                : null,
          });
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          settle({
            ok: false,
            error: `HTTP ${status} ${res.statusMessage ?? ''}`.trim(),
            code: 'fetch_failed',
          });
          return;
        }
        const declared = Number(res.headers['content-length']);
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy();
          settle({
            ok: false,
            error: `File is larger than ${maxBytes} bytes`,
            code: 'too_large',
          });
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            settle({
              ok: false,
              error: `File is larger than ${maxBytes} bytes`,
              code: 'too_large',
            });
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            const body = decompress(
              Buffer.concat(chunks),
              res.headers['content-encoding'],
              maxBytes,
            );
            settle({
              kind: 'body',
              bytes: new Uint8Array(body),
              headers: res.headers,
            });
          } catch (error) {
            settle({
              ok: false,
              error:
                error instanceof RangeError
                  ? `File is larger than ${maxBytes} bytes`
                  : error instanceof Error
                  ? error.message
                  : 'Could not read response',
              code: error instanceof RangeError ? 'too_large' : 'fetch_failed',
            });
          }
        });
        res.on('error', (error) => {
          settle({ ok: false, error: error.message, code: 'fetch_failed' });
        });
      },
    );
    deadline = setTimeout(() => {
      req.destroy(new Error('Timed out while reading the link'));
    }, timeoutMs);
    req.on('error', (error: NodeJS.ErrnoException) => {
      settle({
        ok: false,
        error: error.message,
        code: error.code === 'EHYPHA_BLOCKED' ? 'blocked_url' : 'fetch_failed',
      });
    });
    req.end();
  });

function filenameFromUrl(url: URL): string {
  const last = url.pathname.split('/').filter(Boolean).pop();
  if (!last) return url.hostname;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/**
 * Read a link or uploaded document a member shared in a Space Context chat.
 * https only; every hop is checked against private and internal networks.
 * When `sharedUrls` is given, only URLs members actually posted can be read,
 * so fetched content cannot steer the model into reading arbitrary URLs.
 */
export async function readSpaceContextSharedSource(
  {
    url,
    filename,
    maxBytes = ASSET_DEFAULT_MAX_BYTES,
    sharedUrls,
  }: {
    url: string;
    filename?: string | null;
    maxBytes?: number;
    sharedUrls?: string[];
  },
  deps: { fetchOnce?: SharedSourceFetchOnce } = {},
): Promise<SpaceContextSharedSourceResult> {
  const parsed = parseSharedSourceUrl(url);
  if (!parsed.ok) return parsed;
  if (sharedUrls && !isSharedSourceUrl(parsed.url.href, sharedUrls)) {
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
  const doFetch = deps.fetchOnce ?? fetchOnce;
  const startedAt = Date.now();
  let current = parsed.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const remaining = FETCH_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining <= 0) {
      return {
        ok: false,
        error: 'Timed out while reading the link',
        code: 'fetch_failed',
      };
    }
    const result = await doFetch(current, limit, remaining);
    if ('ok' in result) return result;
    if (result.kind === 'redirect') {
      if (!result.location) {
        return {
          ok: false,
          error: 'Redirect without a location',
          code: 'fetch_failed',
        };
      }
      let next: string;
      try {
        next = new URL(result.location, current).href;
      } catch {
        return { ok: false, error: 'Invalid redirect', code: 'fetch_failed' };
      }
      const checked = parseSharedSourceUrl(next);
      if (!checked.ok) return checked;
      current = checked.url;
      continue;
    }
    const contentType =
      typeof result.headers['content-type'] === 'string'
        ? result.headers['content-type']
        : null;
    const disposition =
      typeof result.headers['content-disposition'] === 'string'
        ? result.headers['content-disposition']
        : null;
    const name =
      filename?.trim() ||
      filenameFromContentDisposition(disposition) ||
      filenameFromUrl(current);
    const decoded = await decodeSharedSourceBytes({
      bytes: result.bytes,
      contentType,
      filename: name,
    });
    if (!decoded.ok) return decoded;
    const { ok: _ok, ...content } = decoded;
    return {
      ok: true,
      url: parsed.url.href,
      final_url: current.href,
      ...content,
    };
  }
  return { ok: false, error: 'Too many redirects', code: 'fetch_failed' };
}
