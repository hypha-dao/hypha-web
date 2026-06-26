function normalizePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function readUrlField(record: Record<string, unknown>): string | null {
  for (const key of ['ufsUrl', 'url', 'fileUrl', 'appUrl'] as const) {
    const url = normalizePublicUrl(record[key]);
    if (url) return url;
  }
  return null;
}

export function resolveUploadUrl(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;

  const envelope = result as {
    error?: unknown;
    data?: unknown;
  };

  if (envelope.error) return null;

  const candidates: unknown[] = [envelope.data, result];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const url = readUrlField(candidate as Record<string, unknown>);
    if (url) return url;
  }

  return null;
}
