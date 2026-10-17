import { sql } from 'drizzle-orm';

import type { DatabaseInstance } from '../common/server/types';
import { parseCapitalKey, parseCapitalKeys, type CapitalKey } from './capitals';

/**
 * `coherences.capitals` and `tokens.capital` stay off the Drizzle schema, same
 * as `spaces.exchange_capitals`. A column on the schema is selected by every
 * `select().from(...)`, which fails the whole read before the migration runs.
 */

let coherenceCapitalsAvailable: boolean | null = null;
let tokenCapitalAvailable: boolean | null = null;

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

function isMissingColumn(error: unknown, column: string): boolean {
  const text = errorText(error);
  if (!text.includes('42703') && !text.includes('does not exist')) return false;
  return (
    text.includes(`"${column}"`) || text.includes(`${column} does not exist`)
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

function sqlList(values: Array<number | string>) {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

export async function readCoherenceCapitalsByIds(
  db: DatabaseInstance,
  ids: number[],
): Promise<Map<number, CapitalKey[]>> {
  const capitals = new Map<number, CapitalKey[]>();
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (unique.length === 0 || coherenceCapitalsAvailable === false) {
    return capitals;
  }
  try {
    const result = await db.execute(
      sql`select id, capitals from coherences where id in (${sqlList(unique)})`,
    );
    coherenceCapitalsAvailable = true;
    for (const row of rowsOf(result)) {
      if (!row || typeof row !== 'object') continue;
      const id = Number((row as { id?: unknown }).id);
      if (!Number.isInteger(id)) continue;
      capitals.set(
        id,
        parseCapitalKeys((row as { capitals?: unknown }).capitals),
      );
    }
    return capitals;
  } catch (error) {
    if (isMissingColumn(error, 'capitals')) {
      coherenceCapitalsAvailable = false;
      return capitals;
    }
    throw error;
  }
}

export async function readCoherenceCapitalsBySlugs(
  db: DatabaseInstance,
  slugs: string[],
): Promise<Map<string, CapitalKey[]>> {
  const capitals = new Map<string, CapitalKey[]>();
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (unique.length === 0 || coherenceCapitalsAvailable === false) {
    return capitals;
  }
  try {
    const result = await db.execute(
      sql`select slug, capitals from coherences where slug in (${sqlList(
        unique,
      )})`,
    );
    coherenceCapitalsAvailable = true;
    for (const row of rowsOf(result)) {
      if (!row || typeof row !== 'object') continue;
      const slug = (row as { slug?: unknown }).slug;
      if (typeof slug !== 'string' || !slug) continue;
      capitals.set(
        slug,
        parseCapitalKeys((row as { capitals?: unknown }).capitals),
      );
    }
    return capitals;
  } catch (error) {
    if (isMissingColumn(error, 'capitals')) {
      coherenceCapitalsAvailable = false;
      return capitals;
    }
    throw error;
  }
}

export async function writeCoherenceCapitals(
  db: DatabaseInstance,
  coherenceId: number,
  capitals: CapitalKey[],
): Promise<boolean> {
  if (coherenceCapitalsAvailable === false) return false;
  try {
    await db.execute(
      sql`update coherences set capitals = ${JSON.stringify(
        capitals,
      )}::jsonb where id = ${coherenceId}`,
    );
    coherenceCapitalsAvailable = true;
    return true;
  } catch (error) {
    if (isMissingColumn(error, 'capitals')) {
      coherenceCapitalsAvailable = false;
      return false;
    }
    throw error;
  }
}

export async function attachCoherenceCapitals<T extends { id: number }>(
  db: DatabaseInstance,
  rows: T[],
): Promise<Array<T & { capitals: CapitalKey[] }>> {
  if (rows.length === 0) return [];
  const stored = await readCoherenceCapitalsByIds(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...row,
    capitals:
      stored.get(row.id) ??
      parseCapitalKeys((row as { capitals?: unknown }).capitals),
  }));
}

export async function readTokenCapitals(
  db: DatabaseInstance,
  ids: number[],
): Promise<Map<number, CapitalKey | null>> {
  const capitals = new Map<number, CapitalKey | null>();
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (unique.length === 0 || tokenCapitalAvailable === false) return capitals;
  try {
    const result = await db.execute(
      sql`select id, capital from tokens where id in (${sqlList(unique)})`,
    );
    tokenCapitalAvailable = true;
    for (const row of rowsOf(result)) {
      if (!row || typeof row !== 'object') continue;
      const id = Number((row as { id?: unknown }).id);
      if (!Number.isInteger(id)) continue;
      capitals.set(id, parseCapitalKey((row as { capital?: unknown }).capital));
    }
    return capitals;
  } catch (error) {
    if (isMissingColumn(error, 'capital')) {
      tokenCapitalAvailable = false;
      return capitals;
    }
    throw error;
  }
}

export async function writeTokenCapital(
  db: DatabaseInstance,
  tokenId: number,
  capital: CapitalKey | null,
): Promise<boolean> {
  if (tokenCapitalAvailable === false) return false;
  try {
    if (capital == null) {
      await db.execute(
        sql`update tokens set capital = null where id = ${tokenId}`,
      );
    } else {
      await db.execute(
        sql`update tokens set capital = ${capital} where id = ${tokenId}`,
      );
    }
    tokenCapitalAvailable = true;
    return true;
  } catch (error) {
    if (isMissingColumn(error, 'capital')) {
      tokenCapitalAvailable = false;
      return false;
    }
    throw error;
  }
}
