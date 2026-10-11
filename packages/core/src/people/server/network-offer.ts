import { sql } from 'drizzle-orm';

import type { DatabaseInstance } from '../../common/server/types';

function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error && current.message)
      parts.push(current.message);
    else if (typeof current === 'string' && current) parts.push(current);
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

export function isMissingNetworkOfferColumn(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes('network_offer') &&
    (text.includes('42703') || text.includes('does not exist'))
  );
}

function firstOffer(result: unknown): string | null | undefined {
  const row = Array.isArray(result)
    ? result[0]
    : result && typeof result === 'object' && 'rows' in result
    ? (result as { rows?: unknown[] }).rows?.[0]
    : undefined;
  if (!row || typeof row !== 'object' || !('network_offer' in row)) {
    return undefined;
  }
  const value = (row as { network_offer?: unknown }).network_offer;
  return typeof value === 'string' || value === null ? value : undefined;
}

/** Missing column is distinct from an empty answer, so home does not nag early. */
export async function readNetworkOffer(
  db: DatabaseInstance,
  personId: number,
): Promise<string | null | undefined> {
  try {
    const result = await db.execute(
      sql`select network_offer from people where id = ${personId} limit 1`,
    );
    const value = firstOffer(result);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || null;
    }
    return null;
  } catch (error) {
    if (isMissingNetworkOfferColumn(error)) return undefined;
    throw error;
  }
}

export async function writeNetworkOffer(
  db: DatabaseInstance,
  personId: number,
  offer: string,
): Promise<boolean> {
  const trimmed = offer.trim();
  if (!trimmed) return false;
  try {
    await db.execute(
      sql`update people set network_offer = ${trimmed}, updated_at = now() where id = ${personId}`,
    );
    return true;
  } catch (error) {
    if (isMissingNetworkOfferColumn(error)) return false;
    throw error;
  }
}
