import { sql } from 'drizzle-orm';

import type { DatabaseInstance } from '../common/server/types';
import { parseCapitalKeys, type CapitalKey } from './capitals';

export type SpaceCapitals = {
  seeks: CapitalKey[];
  offers: CapitalKey[];
};

function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error && current.message)
      parts.push(current.message);
    else if (typeof current === 'string' && current) parts.push(current);
    if (typeof current === 'object' && current && 'cause' in current) {
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return parts.join('\n');
}

function isMissingCapitalsColumn(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes('exchange_capitals') &&
    (text.includes('42703') || text.includes('does not exist'))
  );
}

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

function parseStored(value: unknown): SpaceCapitals {
  const record =
    typeof value === 'string'
      ? safeJson(value)
      : value && typeof value === 'object'
      ? (value as { seeks?: unknown; offers?: unknown })
      : null;
  if (!record) return { seeks: [], offers: [] };
  return {
    seeks: parseCapitalKeys(record.seeks),
    offers: parseCapitalKeys(record.offers),
  };
}

function safeJson(value: string): { seeks?: unknown; offers?: unknown } | null {
  try {
    const parsed = JSON.parse(value) as { seeks?: unknown; offers?: unknown };
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function readSpaceCapitals(
  db: DatabaseInstance,
  spaceIds: number[],
): Promise<Map<number, SpaceCapitals>> {
  const capitals = new Map<number, SpaceCapitals>();
  const ids = [...new Set(spaceIds.filter((id) => Number.isInteger(id)))];
  if (ids.length === 0) return capitals;
  try {
    const result = await db.execute(
      sql`select id, exchange_capitals from spaces where id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    for (const row of rowsOf(result)) {
      if (!row || typeof row !== 'object') continue;
      const id = Number((row as { id?: unknown }).id);
      if (!Number.isInteger(id)) continue;
      capitals.set(
        id,
        parseStored((row as { exchange_capitals?: unknown }).exchange_capitals),
      );
    }
    return capitals;
  } catch (error) {
    if (isMissingCapitalsColumn(error)) return capitals;
    throw error;
  }
}

export async function writeSpaceCapitals(
  db: DatabaseInstance,
  spaceId: number,
  capitals: SpaceCapitals,
): Promise<boolean> {
  const payload = JSON.stringify({
    seeks: capitals.seeks,
    offers: capitals.offers,
  });
  try {
    await db.execute(
      sql`update spaces set exchange_capitals = ${payload}::jsonb, updated_at = now() where id = ${spaceId}`,
    );
    return true;
  } catch (error) {
    if (isMissingCapitalsColumn(error)) return false;
    throw error;
  }
}
