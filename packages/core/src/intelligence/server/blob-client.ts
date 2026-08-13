import 'server-only';

import { del, get, list, put, type PutBlobResult } from '@vercel/blob';

export class IntelligenceBlobNotConfiguredError extends Error {
  constructor() {
    super(
      'Space Intelligence storage is not configured (missing BLOB_READ_WRITE_TOKEN).',
    );
    this.name = 'IntelligenceBlobNotConfiguredError';
  }
}

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

export function isIntelligenceBlobConfigured(): boolean {
  return Boolean(blobToken());
}

function requireToken(): string {
  const token = blobToken();
  if (!token) {
    throw new IntelligenceBlobNotConfiguredError();
  }
  return token;
}

async function streamToString(
  stream: ReadableStream<Uint8Array> | null,
): Promise<string> {
  if (!stream) return '';
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8').decode(merged);
}

/** Read private blob text by pathname. Returns null if missing. */
export async function readIntelligenceBlobText(
  pathname: string,
): Promise<string | null> {
  const token = requireToken();
  const result = await get(pathname, {
    access: 'private',
    token,
    useCache: false,
  });
  if (!result || result.statusCode === 304 || !result.stream) {
    return null;
  }
  return streamToString(result.stream);
}

export async function putIntelligenceBlobText(input: {
  pathname: string;
  body: string;
  /** When true, overwrite an existing object at pathname. */
  allowOverwrite?: boolean;
  /** Optimistic concurrency against blob ETag when overwriting. */
  ifMatch?: string;
  contentType?: string;
}): Promise<PutBlobResult> {
  const token = requireToken();
  return put(input.pathname, input.body, {
    access: 'private',
    token,
    addRandomSuffix: false,
    allowOverwrite: input.allowOverwrite ?? false,
    ifMatch: input.ifMatch,
    contentType: input.contentType ?? 'text/markdown; charset=utf-8',
    cacheControlMaxAge: 60,
  });
}

export async function listIntelligenceBlobPrefix(input: {
  prefix: string;
  cursor?: string;
  limit?: number;
}): Promise<{
  blobs: Array<{
    pathname: string;
    url: string;
    uploadedAt: Date;
    etag: string;
  }>;
  cursor?: string;
  hasMore: boolean;
}> {
  const token = requireToken();
  const result = await list({
    prefix: input.prefix,
    cursor: input.cursor,
    limit: input.limit ?? 1000,
    token,
  });
  return {
    blobs: result.blobs.map((b) => ({
      pathname: b.pathname,
      url: b.url,
      uploadedAt: b.uploadedAt,
      etag: b.etag,
    })),
    cursor: result.cursor,
    hasMore: result.hasMore,
  };
}

export async function deleteIntelligenceBlob(pathname: string): Promise<void> {
  const token = requireToken();
  await del(pathname, { token });
}
