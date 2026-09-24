/**
 * OneSignal rejection payloads can carry recipient identifiers — e.g. `invalid_aliases` lists the
 * `external_id`s (person slugs) it could not deliver to — and nested objects print as `[Object]` in
 * server logs. This keeps the *shape* of an error (which keys, how many items) and the human
 * readable message strings, and drops everything else, so a failed send stays diagnosable without
 * writing identifiers to the log.
 */
const MESSAGE_KEYS = new Set([
  'errors',
  'error',
  'message',
  'title',
  'warnings',
]);
const MAX_MESSAGE_LENGTH = 200;

function truncate(value: string): string {
  return value.length > MAX_MESSAGE_LENGTH
    ? `${value.slice(0, MAX_MESSAGE_LENGTH)}…`
    : value;
}

export function redactForLog(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    if (key && MESSAGE_KEYS.has(key)) return truncate(value);
    return '<redacted>';
  }

  if (Array.isArray(value)) {
    const isMessageList =
      key !== undefined &&
      MESSAGE_KEYS.has(key) &&
      value.every((item) => typeof item === 'string');
    return isMessageList
      ? value.map((item) => truncate(item as string))
      : `[${value.length} items]`;
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        redactForLog(v, k),
      ]),
    );
  }

  return `<${typeof value}>`;
}

/** Serialises a redacted error value for a log line; a JSON string body is parsed first. */
export function redactedLogString(
  value: unknown,
  key?: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;

  let candidate = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value);
    } catch {
      // Not JSON: a plain message string from OneSignal or the HTTP layer.
      return truncate(value);
    }
  }

  try {
    return JSON.stringify(redactForLog(candidate, key));
  } catch {
    return '<unserialisable>';
  }
}
