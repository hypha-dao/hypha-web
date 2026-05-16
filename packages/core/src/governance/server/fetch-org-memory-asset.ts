import 'server-only';

import { createRequire } from 'node:module';

import type { DbConfig } from '../../server';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { HYPHA_MEDIA_BUNDLE_FIELD } from '../../matrix/rich-reply';
import { findAllDocumentsBySpaceSlugWithoutPagination } from './queries';
import { parseOrgMemoryAssetKey } from '../../org-memory/org-memory-asset-key';
import { getSpaceCallArtifactById } from './call-artifacts';
import type {
  SpaceCallRecording,
  SpaceCallTranscript,
  SpaceDiscussionSummary,
} from '@hypha-platform/storage-postgres';

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
const DEFAULT_FETCH_TIMEOUT_MS = 25_000;
const MAX_TEXT_CHARS = 48_000;

export type FetchOrgMemoryAssetInput = {
  spaceSlug: string;
  asset_key: string;
  /**
   * auto: UTF-8 text + PDF text + images/video/Office as base64 (AI/multimodal).
   * text_only: only UTF-8 text bodies and PDF text (no raw/binary for images/video).
   * binary_as_base64: raw base64 for allowed binary MIME types (see matrixHomeserverFetch).
   */
  return_mode?: 'auto' | 'text_only' | 'binary_as_base64';
  max_bytes?: number;
};

export type FetchOrgMemoryAssetSuccess = {
  ok: true;
  filename: string;
  mime: string;
  /** utf-8 text when mode is text */
  text?: string;
  text_truncated?: boolean;
  /** base64 when mode is binary */
  data_base64?: string;
  mode: 'text' | 'binary';
  byte_length: number;
};

export type FetchOrgMemoryAssetFailure = {
  ok: false;
  error: string;
  code?:
    | 'invalid_asset_key'
    | 'access_denied'
    | 'not_found'
    | 'unsupported_type'
    | 'too_large'
    | 'fetch_failed'
    | 'matrix_auth'
    | 'decode_failed';
};

export type FetchOrgMemoryAssetResult =
  | FetchOrgMemoryAssetSuccess
  | FetchOrgMemoryAssetFailure;

function parseMxc(mxc: string): { serverName: string; mediaId: string } | null {
  const trimmed = mxc.trim();
  if (!trimmed.startsWith('mxc://')) return null;
  const rest = trimmed.slice('mxc://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  const serverName = decodeURIComponent(rest.slice(0, slash));
  const mediaId = decodeURIComponent(rest.slice(slash + 1));
  if (!serverName || !mediaId) return null;
  return { serverName, mediaId };
}

function matrixMediaDownloadPath(
  homeserver: string,
  serverName: string,
  mediaId: string,
): string {
  const base = homeserver.replace(/\/?$/, '');
  const encServer = encodeURIComponent(serverName);
  const encMedia = encodeURIComponent(mediaId);
  return `${base}/_matrix/media/v3/download/${encServer}/${encMedia}`;
}

function extractMxcsFromMessageEvent(
  content: Record<string, unknown> | undefined,
): string[] {
  const urls: string[] = [];
  if (!content) return urls;
  const root = content.url;
  if (typeof root === 'string' && root.startsWith('mxc://')) {
    urls.push(root.trim());
  }
  const bundleRaw = content[HYPHA_MEDIA_BUNDLE_FIELD];
  if (!Array.isArray(bundleRaw)) return urls;
  for (const item of bundleRaw) {
    if (typeof item !== 'object' || item === null) continue;
    const u = (item as { url?: string }).url;
    if (typeof u === 'string' && u.startsWith('mxc://')) {
      urls.push(u.trim());
    }
  }
  return urls;
}

type MatrixEventVerifyResult = { ok: true; filename: string } | { ok: false };

function filenameFromMessageContent(
  content: Record<string, unknown> | undefined,
  targetMxc: string,
): string {
  if (!content) return 'attachment';
  const want = targetMxc.trim();
  const rootUrl = content.url;
  if (typeof rootUrl === 'string' && rootUrl.trim() === want) {
    const fn = content.filename;
    if (typeof fn === 'string' && fn.trim()) return fn.trim();
    const body = content.body;
    if (typeof body === 'string' && body.trim()) return body.trim();
  }
  const bundleRaw = content[HYPHA_MEDIA_BUNDLE_FIELD];
  if (Array.isArray(bundleRaw)) {
    for (const item of bundleRaw) {
      if (typeof item !== 'object' || item === null) continue;
      const it = item as {
        url?: string;
        filename?: string;
        body?: string;
      };
      if (typeof it.url === 'string' && it.url.trim() === want) {
        if (typeof it.filename === 'string' && it.filename.trim()) {
          return it.filename.trim();
        }
        if (typeof it.body === 'string' && it.body.trim())
          return it.body.trim();
      }
    }
  }
  return 'attachment';
}

/**
 * Verify room+event references the MXC (GET /event/{eventId}) — not limited to
 * the /messages pagination window.
 */
async function verifyMatrixEventForMxc(
  homeserver: string,
  roomId: string,
  eventId: string,
  targetMxc: string,
  accessToken: string,
): Promise<MatrixEventVerifyResult> {
  const base = homeserver.replace(/\/?$/, '');
  const path = `${base}/_matrix/client/v3/rooms/${encodeURIComponent(
    roomId,
  )}/event/${encodeURIComponent(eventId)}`;

  let res = await fetch(path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) {
    const qp = new URLSearchParams({ access_token: accessToken });
    res = await fetch(`${path}?${qp.toString()}`, {
      signal: AbortSignal.timeout(15_000),
    });
  }
  if (!res.ok) return { ok: false };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false };
  }
  const o = body as { content?: Record<string, unknown> };
  const mxcs = extractMxcsFromMessageEvent(o.content);
  const want = targetMxc.trim();
  if (!mxcs.some((m) => m === want)) return { ok: false };
  return {
    ok: true,
    filename: filenameFromMessageContent(o.content, want),
  };
}

async function resolveMatrixAccessToken(
  authToken: string | undefined,
  requestUrlForSessionMatrix: string | undefined,
): Promise<{ token: string; usedSession: boolean } | null> {
  const botToken =
    process.env.HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN?.trim() ?? '';
  if (botToken) return { token: botToken, usedSession: false };

  const sessionAuth = authToken?.trim();
  const sessionReqUrl = requestUrlForSessionMatrix?.trim();
  if (!sessionAuth || !sessionReqUrl) return null;

  const { resolveUserMatrixAccessTokenForOrgMemory } = await import(
    './resolve-user-matrix-access-token-for-org-memory'
  );
  const resolved = await resolveUserMatrixAccessTokenForOrgMemory(
    sessionAuth,
    sessionReqUrl,
  );
  if (!resolved) return null;
  return { token: resolved, usedSession: true };
}

function normalizeMime(headerMime: string | null, filename: string): string {
  const h = headerMime?.split(';')[0]?.trim().toLowerCase();
  if (h && h !== 'application/octet-stream') return h;
  const fn = filename.toLowerCase();
  if (fn.endsWith('.png')) return 'image/png';
  if (fn.endsWith('.jpg') || fn.endsWith('.jpeg')) return 'image/jpeg';
  if (fn.endsWith('.gif')) return 'image/gif';
  if (fn.endsWith('.webp')) return 'image/webp';
  if (fn.endsWith('.svg')) return 'image/svg+xml';
  if (fn.endsWith('.pdf')) return 'application/pdf';
  if (fn.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (fn.endsWith('.doc')) return 'application/msword';
  if (fn.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (fn.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (fn.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (fn.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (fn.endsWith('.txt') || fn.endsWith('.md')) return 'text/plain';
  return headerMime?.split(';')[0]?.trim() || 'application/octet-stream';
}

function isPlaintextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith('text/') ||
    m === 'application/json' ||
    m === 'application/xml' ||
    m.endsWith('+xml') ||
    m.endsWith('+json')
  );
}

function isImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('image/');
}

function isPdfMime(mime: string): boolean {
  return mime.toLowerCase() === 'application/pdf';
}

function isVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('video/');
}

/** Office docs — binary for AI; true transcription deferred (no mammoth in v1). */
function isOfficeDocMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'application/msword' ||
    m === 'application/vnd.ms-word' ||
    m ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    m === 'application/vnd.ms-powerpoint' ||
    m ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    m === 'application/vnd.ms-excel' ||
    m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    m === 'application/vnd.ms-excel.sheet.macroenabled.12'
  );
}

function utf8Decode(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function truncateText(
  s: string,
  max: number,
): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max), truncated: true };
}

async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const requirePdf = createRequire(import.meta.url);
    const pdfParse = requirePdf('pdf-parse') as (
      data: Buffer,
    ) => Promise<{ text?: string }>;
    const buf = Buffer.from(bytes);
    const data = await pdfParse(buf);
    const t = typeof data.text === 'string' ? data.text.trim() : '';
    return t.length > 0 ? t : '';
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function matrixHomeserverFetch(
  url: string,
  accessToken: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<
  | { ok: true; bytes: Uint8Array; mime: string | null }
  | { ok: false; message: string }
> {
  try {
    let res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 401 && url.includes('access_token=') === false) {
      const sep = url.includes('?') ? '&' : '?';
      res = await fetch(
        `${url}${sep}access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `HTTP ${res.status} ${res.statusText || ''}`.trim(),
      };
    }
    const lenHeader = res.headers.get('content-length');
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > maxBytes) {
        return { ok: false, message: `Content-Length ${n} exceeds max_bytes` };
      }
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      return {
        ok: false,
        message: `Response size ${buf.byteLength} exceeds max_bytes`,
      };
    }
    return {
      ok: true,
      bytes: buf,
      mime: res.headers.get('content-type'),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

/** Unsigned HTTPS fetch for proposal/CDN URLs (no Matrix token). */
async function fetchBytes(
  url: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<
  | { ok: true; bytes: Uint8Array; mime: string | null }
  | { ok: false; message: string }
> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `HTTP ${res.status} ${res.statusText || ''}`.trim(),
      };
    }
    const lenHeader = res.headers.get('content-length');
    if (lenHeader) {
      const n = Number(lenHeader);
      if (Number.isFinite(n) && n > maxBytes) {
        return { ok: false, message: `Content-Length ${n} exceeds max_bytes` };
      }
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      return {
        ok: false,
        message: `Response size ${buf.byteLength} exceeds max_bytes`,
      };
    }
    return {
      ok: true,
      bytes: buf,
      mime: res.headers.get('content-type'),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

function findProposalAsset(
  docs: Awaited<
    ReturnType<typeof findAllDocumentsBySpaceSlugWithoutPagination>
  >,
  documentId: number,
  appUrl: string,
): { filename: string; url: string } | null {
  const doc = docs.find((d) => d.id === documentId);
  if (!doc) return null;
  const want = appUrl.trim();

  if (doc.leadImage?.trim() === want) {
    return {
      filename: want.split('/').pop() || 'lead-image',
      url: doc.leadImage,
    };
  }
  const attachments = doc.attachments ?? [];
  for (const raw of attachments) {
    const url = typeof raw === 'string' ? raw : raw.url;
    if (url?.trim() === want) {
      const name =
        typeof raw === 'string'
          ? url.split('/').pop() || 'attachment'
          : raw.name?.trim() || url.split('/').pop() || 'attachment';
      return { filename: name, url };
    }
  }
  return null;
}

function buildSuccessText(
  filename: string,
  mime: string,
  text: string,
  truncated: boolean,
  byteLength: number,
): FetchOrgMemoryAssetSuccess {
  return {
    ok: true,
    filename,
    mime,
    mode: 'text',
    text,
    text_truncated: truncated,
    byte_length: byteLength,
  };
}

function buildSuccessBinary(
  filename: string,
  mime: string,
  dataBase64: string,
  byteLength: number,
): FetchOrgMemoryAssetSuccess {
  return {
    ok: true,
    filename,
    mime,
    mode: 'binary',
    data_base64: dataBase64,
    byte_length: byteLength,
  };
}

/**
 * Fetch bytes for a single org-memory asset after space access check.
 * Matrix uses server-side media download URL + same token path as org memory listing.
 */
export async function fetchOrgMemoryAsset(
  {
    spaceSlug,
    asset_key,
    return_mode = 'auto',
    max_bytes = DEFAULT_MAX_BYTES,
  }: FetchOrgMemoryAssetInput,
  {
    db,
    authToken,
    requestUrlForSessionMatrix,
  }: DbConfig & {
    authToken?: string;
    requestUrlForSessionMatrix?: string;
  },
): Promise<
  | { access: 'ok'; result: FetchOrgMemoryAssetResult }
  | { access: 'denied'; message: string }
> {
  const key = parseOrgMemoryAssetKey(asset_key);
  if (!key) {
    return {
      access: 'ok',
      result: {
        ok: false,
        error: 'Invalid asset_key',
        code: 'invalid_asset_key',
      },
    };
  }

  const host = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (!host) {
    return {
      access: 'ok',
      result: { ok: false, error: 'Space not found', code: 'not_found' },
    };
  }

  if (host.web3SpaceId != null) {
    if (!canConvertToBigInt(host.web3SpaceId)) {
      return {
        access: 'denied',
        message: `Space "${host.slug}" has an invalid on-chain space id.`,
      };
    }
    const gate = await checkSpaceAccessForSpace(host, authToken);
    if (!gate.hasAccess) {
      return { access: 'denied', message: gate.message };
    }
  }

  const docs = await findAllDocumentsBySpaceSlugWithoutPagination(
    { spaceSlug, searchTerm: undefined, order: [] },
    { db },
  );

  let fetchUrl: string | null = null;
  /** Set for Matrix media downloads (Bearer + query fallback); proposal URLs use `fetchBytes` only. */
  let matrixAccessToken: string | undefined;
  let filename = 'asset';

  if (key.k === 'p') {
    const hit = findProposalAsset(docs, key.d, key.u);
    if (!hit) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: 'Proposal asset not found for this space',
          code: 'not_found',
        },
      };
    }
    fetchUrl = hit.url.trim();
    filename = hit.filename;
  } else if (key.k === 'm') {
    const matrixRoomId = host.chatRoomId?.trim() ?? '';
    if (!matrixRoomId || key.r !== matrixRoomId) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: 'Matrix asset not in this space chat room',
          code: 'not_found',
        },
      };
    }
    const mxcParsed = parseMxc(key.x);
    if (!mxcParsed) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: 'Invalid mxc in asset key',
          code: 'invalid_asset_key',
        },
      };
    }

    const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
      /\/?$/,
      '',
    );
    if (!homeserver) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: 'Matrix homeserver not configured',
          code: 'matrix_auth',
        },
      };
    }
    const tokenPack = await resolveMatrixAccessToken(
      authToken,
      requestUrlForSessionMatrix,
    );
    if (!tokenPack) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error:
            'No Matrix access token (set HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN or use a session with Human Chat Matrix linked)',
          code: 'matrix_auth',
        },
      };
    }

    const verified = await verifyMatrixEventForMxc(
      homeserver,
      matrixRoomId,
      key.e,
      key.x,
      tokenPack.token,
    );
    if (!verified.ok) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error:
            'Matrix event not found, or this MXC is not attached to that event (check membership)',
          code: 'not_found',
        },
      };
    }

    filename = verified.filename;
    fetchUrl = matrixMediaDownloadPath(
      homeserver,
      mxcParsed.serverName,
      mxcParsed.mediaId,
    );
    matrixAccessToken = tokenPack.token;
  } else if (key.k === 'cr') {
    const recording = (await getSpaceCallArtifactById(
      { kind: 'recording', id: key.i, spaceId: host.id },
      { db },
    )) as SpaceCallRecording | null;
    if (!recording) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: 'Call recording not found for this space',
          code: 'not_found',
        },
      };
    }
    filename =
      recording.mediaUri.split('/').pop()?.trim() ||
      `recording-${recording.callSessionId}.webm`;
    fetchUrl = recording.mediaUri;
  } else if (key.k === 'ct') {
    const transcript = (await getSpaceCallArtifactById(
      { kind: 'transcript', id: key.i, spaceId: host.id },
      { db },
    )) as SpaceCallTranscript | null;
    if (!transcript) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: 'Call transcript not found for this space',
          code: 'not_found',
        },
      };
    }
    const textPayload = transcript.text;
    const { text, truncated } = truncateText(textPayload, MAX_TEXT_CHARS);
    return {
      access: 'ok',
      result: buildSuccessText(
        `call-transcript-${transcript.callSessionId}.txt`,
        'text/plain',
        text,
        truncated,
        textPayload.length,
      ),
    };
  } else if (key.k === 'ds') {
    const summary = (await getSpaceCallArtifactById(
      { kind: 'discussion_summary', id: key.i, spaceId: host.id },
      { db },
    )) as SpaceDiscussionSummary | null;
    if (!summary) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: 'Discussion summary not found for this space',
          code: 'not_found',
        },
      };
    }
    const bullets = Array.isArray(summary.bullets)
      ? summary.bullets.filter(
          (b: unknown): b is string => typeof b === 'string',
        )
      : [];
    const body = [summary.summary, ...bullets.map((b) => `- ${b}`)]
      .join('\n')
      .trim();
    const { text, truncated } = truncateText(body, MAX_TEXT_CHARS);
    return {
      access: 'ok',
      result: buildSuccessText(
        `discussion-summary-${summary.id}.md`,
        'text/markdown',
        text,
        truncated,
        body.length,
      ),
    };
  }

  if (!fetchUrl) {
    return {
      access: 'ok',
      result: { ok: false, error: 'No fetch URL', code: 'fetch_failed' },
    };
  }

  const fetched = matrixAccessToken
    ? await matrixHomeserverFetch(
        fetchUrl,
        matrixAccessToken,
        max_bytes,
        DEFAULT_FETCH_TIMEOUT_MS,
      )
    : await fetchBytes(fetchUrl, max_bytes, DEFAULT_FETCH_TIMEOUT_MS);
  if (!fetched.ok) {
    return {
      access: 'ok',
      result: {
        ok: false,
        error: fetched.message,
        code: 'fetch_failed',
      },
    };
  }

  const mime = normalizeMime(fetched.mime, filename);
  const bytes = fetched.bytes;

  if (return_mode === 'binary_as_base64') {
    const binOk =
      isImageMime(mime) ||
      isPdfMime(mime) ||
      isVideoMime(mime) ||
      isOfficeDocMime(mime);
    if (!binOk) {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: `binary_as_base64 supports image/*, video/*, application/pdf, and common Office MIME types; got ${mime}`,
          code: 'unsupported_type',
        },
      };
    }
    return {
      access: 'ok',
      result: buildSuccessBinary(
        filename,
        mime,
        bytesToBase64(bytes),
        bytes.byteLength,
      ),
    };
  }

  if (return_mode === 'text_only' || return_mode === 'auto') {
    if (isPlaintextMime(mime)) {
      const textRaw = utf8Decode(bytes);
      if (textRaw === null) {
        return {
          access: 'ok',
          result: {
            ok: false,
            error: 'File is not valid UTF-8 text',
            code: 'decode_failed',
          },
        };
      }
      const { text, truncated } = truncateText(textRaw, MAX_TEXT_CHARS);
      return {
        access: 'ok',
        result: buildSuccessText(
          filename,
          mime,
          text,
          truncated,
          bytes.byteLength,
        ),
      };
    }
    if (isPdfMime(mime)) {
      const extracted = await extractPdfText(bytes);
      if (extracted === null) {
        return {
          access: 'ok',
          result: {
            ok: false,
            error: 'Could not extract text from PDF',
            code: 'decode_failed',
          },
        };
      }
      const { text, truncated } = truncateText(extracted, MAX_TEXT_CHARS);
      return {
        access: 'ok',
        result: buildSuccessText(
          filename,
          mime,
          text,
          truncated,
          bytes.byteLength,
        ),
      };
    }
    if (return_mode === 'text_only') {
      return {
        access: 'ok',
        result: {
          ok: false,
          error: `text_only does not support MIME type ${mime}`,
          code: 'unsupported_type',
        },
      };
    }
  }

  if (
    return_mode === 'auto' &&
    (isImageMime(mime) || isVideoMime(mime) || isOfficeDocMime(mime))
  ) {
    return {
      access: 'ok',
      result: buildSuccessBinary(
        filename,
        mime,
        bytesToBase64(bytes),
        bytes.byteLength,
      ),
    };
  }

  return {
    access: 'ok',
    result: {
      ok: false,
      error: `Unsupported or undecodable type for return_mode=${return_mode}: ${mime}`,
      code: 'unsupported_type',
    },
  };
}
