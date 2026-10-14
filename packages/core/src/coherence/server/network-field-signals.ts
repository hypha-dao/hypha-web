import { sql } from 'drizzle-orm';

import type { DatabaseInstance } from '../../common/server/types';
import { parseCapitalKeys } from '../../network/capitals';
import { readSpaceCapitals } from '../../network/exchange-capitals';
import { readCoherenceCapitalsBySlugs } from '../../network/capital-columns';
import {
  NETWORK_FIELD_KINDS,
  type NetworkFieldPayout,
  type NetworkFieldSignal,
  type NetworkFieldSignalKind,
} from '../../network/types';

export { NETWORK_FIELD_KINDS };

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

function asIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

function asTags(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asPayouts(value: unknown): NetworkFieldPayout[] {
  const parsed = typeof value === 'string' ? asTags(value) : value;
  if (!Array.isArray(parsed)) return [];
  const payouts: NetworkFieldPayout[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const amount = asText((entry as { amount?: unknown }).amount);
    const token = asText((entry as { token?: unknown }).token);
    if (!amount || !token) continue;
    payouts.push({ amount, token });
  }
  return payouts;
}

function isFieldKind(value: unknown): value is NetworkFieldSignalKind {
  return (
    typeof value === 'string' &&
    (NETWORK_FIELD_KINDS as readonly string[]).includes(value)
  );
}

export async function listNetworkFieldSignals(
  { kinds }: { kinds: readonly NetworkFieldSignalKind[] },
  { db }: { db: DatabaseInstance },
): Promise<NetworkFieldSignal[]> {
  const allowed = kinds.filter((kind) => isFieldKind(kind));
  if (allowed.length === 0) return [];
  const result = await db.execute(sql`
    select c.slug, c.title, c.description, c.type, c.lead_image, c.video_url,
           c.updated_at, c.tags, c.indicative_payouts,
           s.id as space_id, s.slug as space_slug, s.title as space_title,
           s.location_label, s.chat_room_id, s.description as space_description,
           s.lead_image as space_lead_image,
           coalesce(
             nullif(trim(concat_ws(' ', p.name, p.surname)), ''),
             nullif(trim(p.nickname), '')
           ) as creator_name
    from coherences c
    inner join spaces s on s.id = c.space_id
    left join people p on p.id = c.creator_id
    where c.shared_with_network = true
      and c.type in (${sql.join(
        allowed.map((kind) => sql`${kind}`),
        sql`, `,
      )})
      and coalesce(c.archived, false) = false
      and s.is_archived = false
      and c.slug is not null
    order by c.updated_at desc
    limit 60
  `);
  const drafts: Array<
    Omit<NetworkFieldSignal, 'capital' | 'spaceSeeks' | 'spaceOffers'> & {
      spaceId: number;
      tagged: string | null;
    }
  > = [];
  for (const row of rowsOf(result)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    if (!isFieldKind(record.type)) continue;
    const slug = asText(record.slug);
    const spaceSlug = asText(record.space_slug);
    const spaceId = Number(record.space_id);
    if (!slug || !spaceSlug || !Number.isInteger(spaceId)) continue;
    drafts.push({
      spaceId,
      tagged: parseCapitalKeys(asTags(record.tags))[0] ?? null,
      slug,
      title: asText(record.title),
      description: asText(record.description),
      type: record.type,
      spaceSlug,
      spaceTitle: asText(record.space_title) || spaceSlug,
      place: asText(record.location_label),
      creatorName: asText(record.creator_name) || null,
      spaceChatRoomId: asText(record.chat_room_id) || null,
      leadImage: asText(record.lead_image) || null,
      videoUrl: asText(record.video_url) || null,
      updatedAt: asIso(record.updated_at),
      payouts: asPayouts(record.indicative_payouts),
      spaceDescription: asText(record.space_description),
      spaceLeadImage: asText(record.space_lead_image) || null,
    });
  }
  const [capitals, named] = await Promise.all([
    readSpaceCapitals(
      db,
      drafts.map((draft) => draft.spaceId),
    ),
    readCoherenceCapitalsBySlugs(
      db,
      drafts.map((draft) => draft.slug),
    ),
  ]);
  return drafts.map(({ spaceId, tagged, ...signal }) => ({
    ...signal,
    capital:
      named.get(signal.slug)?.[0] ??
      tagged ??
      capitals.get(spaceId)?.seeks[0] ??
      null,
    spaceSeeks: capitals.get(spaceId)?.seeks ?? [],
    spaceOffers: capitals.get(spaceId)?.offers ?? [],
  }));
}
