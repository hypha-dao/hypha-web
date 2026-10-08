const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const FALLBACK_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

export function resolveImageUploadMime(file: {
  name: string;
  type: string;
}): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const inferred = IMAGE_MIME_BY_EXT[ext];
  const current = file.type === 'image/jpg' ? 'image/jpeg' : file.type;

  if (FALLBACK_MIME_TYPES.has(current) || current === 'image/jpg') {
    return inferred ?? (current === 'image/jpg' ? 'image/jpeg' : current);
  }

  return current;
}

/**
 * Rebuild the File from its bytes so UploadThing's `x-ut-file-size` /
 * `x-ut-file-type` match the PUT body. A 0-byte crop or `image/jpg` MIME
 * produces ingest `XHR failed 400`.
 */
export async function normalizeImageUploadFile(file: File): Promise<File> {
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error(
      `"${file.name}" is empty and cannot be uploaded. Crop or choose the image again.`,
    );
  }

  const type = resolveImageUploadMime(file);
  if (
    type === file.type &&
    file.size === bytes.byteLength &&
    !FALLBACK_MIME_TYPES.has(file.type)
  ) {
    return file;
  }

  return new File([bytes], file.name, {
    type,
    lastModified: file.lastModified,
  });
}

export function formatImageUploadFailure(file: File, error: unknown): Error {
  const ingestError = readUploadThingIngestError(error);
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === 'string'
      ? error
      : 'Upload failed';
  const details =
    ingestError && ingestError !== message ? ingestError : message;

  return new Error(
    `Upload for "${file.name}" (${file.type || 'unknown type'}, ${
      file.size
    } bytes) failed: ${details}`,
  );
}

function readUploadThingIngestError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const data = 'data' in error ? error.data : undefined;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data && typeof data === 'object') {
    if ('error' in data && data.error != null) {
      return String(data.error);
    }
    if ('message' in data && data.message != null) {
      return String(data.message);
    }
  }
  return undefined;
}
