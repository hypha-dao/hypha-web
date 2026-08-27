/**
 * `people.network_visible` landed in 0077. Auth person lookups must keep
 * working when a preview/local DB has not been migrated yet.
 */

function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      continue;
    }
    const record = current as {
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    if (typeof record.message === 'string') parts.push(record.message);
    if (record.code === '42703') parts.push('42703');
    current = record.cause;
  }

  if (typeof error === 'string') parts.push(error);
  return parts.join('\n');
}

export function isMissingNetworkVisibleColumn(error: unknown): boolean {
  const text = collectErrorText(error);
  return (
    /network_visible/i.test(text) &&
    (/does not exist/i.test(text) || text.includes('42703'))
  );
}

export async function withOptionalNetworkVisibleColumn<TWith, TWithout>(
  withColumn: () => Promise<TWith>,
  withoutColumn: () => Promise<TWithout>,
): Promise<TWith | TWithout> {
  try {
    return await withColumn();
  } catch (error) {
    if (!isMissingNetworkVisibleColumn(error)) throw error;
    return withoutColumn();
  }
}

export function omitNetworkVisible<T extends { networkVisible?: boolean }>(
  data: T,
): Omit<T, 'networkVisible'> {
  const { networkVisible: _networkVisible, ...rest } = data;
  return rest;
}
