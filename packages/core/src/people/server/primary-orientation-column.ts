import { sql } from 'drizzle-orm';

import type { DatabaseInstance } from '../../common/server/types';

const ORIENTATIONS = ['member', 'builder', 'investor'] as const;
type Orientation = (typeof ORIENTATIONS)[number];

function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error && current.message) {
      parts.push(current.message);
    } else if (typeof current === 'string' && current) {
      parts.push(current);
    }
    if (typeof current === 'object' && current && 'code' in current) {
      parts.push(String((current as { code?: unknown }).code ?? ''));
    }
    if (typeof current === 'object' && current && 'cause' in current) {
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }

  return parts.join('\n');
}

/** Migration 0080 adds this column. Reads must work before it exists. */
export function isMissingPrimaryOrientationColumn(error: unknown): boolean {
  const text = errorText(error);
  if (text.includes('42703') && text.includes('primary_orientation')) {
    return true;
  }
  return (
    text.includes('primary_orientation') && text.includes('does not exist')
  );
}

function firstOrientation(result: unknown): string | null | undefined {
  const row = Array.isArray(result)
    ? result[0]
    : result && typeof result === 'object' && 'rows' in result
    ? (result as { rows?: unknown[] }).rows?.[0]
    : undefined;
  if (!row || typeof row !== 'object' || !('primary_orientation' in row)) {
    return undefined;
  }
  const value = (row as { primary_orientation?: unknown }).primary_orientation;
  return typeof value === 'string' || value === null ? value : undefined;
}

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

/** One query for a list of people. Missing column yields an empty map. */
export async function readPrimaryOrientations(
  db: DatabaseInstance,
  personIds: number[],
): Promise<Map<number, Orientation>> {
  const ids = [...new Set(personIds.filter((id) => Number.isInteger(id)))];
  const orientations = new Map<number, Orientation>();
  if (ids.length === 0) return orientations;

  try {
    const result = await db.execute(
      sql`select id, primary_orientation from people where id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    for (const row of rowsOf(result)) {
      if (!row || typeof row !== 'object') continue;
      const id = Number((row as { id?: unknown }).id);
      const value = (row as { primary_orientation?: unknown })
        .primary_orientation;
      if (!Number.isInteger(id)) continue;
      if (value === 'member' || value === 'builder' || value === 'investor') {
        orientations.set(id, value);
      }
    }
    return orientations;
  } catch (error) {
    if (isMissingPrimaryOrientationColumn(error)) return orientations;
    throw error;
  }
}

export async function readPrimaryOrientation(
  db: DatabaseInstance,
  personId: number,
): Promise<Orientation | null> {
  try {
    const result = await db.execute(
      sql`select primary_orientation from people where id = ${personId} limit 1`,
    );
    const value = firstOrientation(result);
    if (value === 'member' || value === 'builder' || value === 'investor') {
      return value;
    }
    return null;
  } catch (error) {
    if (isMissingPrimaryOrientationColumn(error)) return null;
    throw error;
  }
}
