import { sql } from 'drizzle-orm';

import type { DatabaseInstance } from '../../common/server/types';
import { parseCapitalKeys } from '../../network/capitals';
import { readSpaceCapitals } from '../../network/exchange-capitals';
import type {
  NetworkOpenNeed,
  NetworkOpenNeedKind,
  NetworkSharedSignal,
  NetworkSignalKind,
  NetworkSpaceRank,
} from '../../network/types';

export type {
  NetworkOpenNeed,
  NetworkOpenNeedKind,
  NetworkSharedSignal,
  NetworkSignalKind,
  NetworkSpaceRank,
};

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

function asKind(value: unknown): NetworkSignalKind | null {
  if (value === 'Need' || value === 'Action' || value === 'Impact')
    return value;
  return null;
}

function asOpenNeedKind(value: unknown): NetworkOpenNeedKind | null {
  if (value === 'Need') return value;
  return null;
}

function asCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
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

export async function listNetworkSharedSignals(
  { type }: { type: NetworkSignalKind },
  { db }: { db: DatabaseInstance },
): Promise<NetworkSharedSignal[]> {
  const result = await db.execute(sql`
    select c.slug, c.title, c.description, c.type, c.lead_image,
           s.slug as space_slug, s.title as space_title, s.chat_room_id
    from coherences c
    inner join spaces s on s.id = c.space_id
    where c.shared_with_network = true
      and c.type = ${type}
      and coalesce(c.archived, false) = false
      and s.is_archived = false
      and c.slug is not null
    order by c.updated_at desc
    limit 60
  `);
  const signals: NetworkSharedSignal[] = [];
  for (const row of rowsOf(result)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const kind = asKind(record.type);
    const slug = typeof record.slug === 'string' ? record.slug : '';
    const spaceSlug =
      typeof record.space_slug === 'string' ? record.space_slug : '';
    if (!kind || !slug || !spaceSlug) continue;
    signals.push({
      slug,
      title: typeof record.title === 'string' ? record.title : '',
      description:
        typeof record.description === 'string' ? record.description : '',
      type: kind,
      spaceSlug,
      spaceTitle:
        typeof record.space_title === 'string' ? record.space_title : spaceSlug,
      spaceChatRoomId:
        typeof record.chat_room_id === 'string' ? record.chat_room_id : null,
      leadImage:
        typeof record.lead_image === 'string' ? record.lead_image : null,
    });
  }
  return signals;
}

export async function listNetworkSpaceRanks({
  db,
}: {
  db: DatabaseInstance;
}): Promise<NetworkSpaceRank[]> {
  const result = await db.execute(sql`
    select s.id, s.slug, s.title, s.location_label, s.chat_room_id,
      count(*) filter (where c.type = 'Need')::int as need_count,
      count(*) filter (where c.type = 'Action')::int as action_count,
      count(*) filter (where c.type = 'Impact')::int as impact_count
    from coherences c
    inner join spaces s on s.id = c.space_id
    where c.shared_with_network = true
      and c.type in ('Need', 'Action', 'Impact')
      and coalesce(c.archived, false) = false
      and s.is_archived = false
    group by s.id, s.slug, s.title, s.location_label, s.chat_room_id
  `);
  const ranks: NetworkSpaceRank[] = [];
  for (const row of rowsOf(result)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const spaceId = Number(record.id);
    const spaceSlug = typeof record.slug === 'string' ? record.slug : '';
    if (!Number.isInteger(spaceId) || !spaceSlug) continue;
    ranks.push({
      spaceId,
      spaceSlug,
      spaceTitle: typeof record.title === 'string' ? record.title : spaceSlug,
      place:
        typeof record.location_label === 'string' ? record.location_label : '',
      chatRoomId:
        typeof record.chat_room_id === 'string' ? record.chat_room_id : null,
      need: Number(record.need_count) || 0,
      action: Number(record.action_count) || 0,
      impact: Number(record.impact_count) || 0,
    });
  }
  return ranks;
}

export async function listNetworkOpenNeeds({
  db,
}: {
  db: DatabaseInstance;
}): Promise<NetworkOpenNeed[]> {
  const result = await db.execute(sql`
    select c.slug, c.title, c.description, c.type, c.lead_image, c.updated_at,
           c.tags, s.id as space_id, s.slug as space_slug, s.title as space_title,
           s.chat_room_id, s.location_label, s.description as space_description,
           s.lead_image as space_lead_image,
           coalesce(counts.action_count, 0) as action_count,
           coalesce(counts.impact_count, 0) as impact_count
    from coherences c
    inner join spaces s on s.id = c.space_id
    left join (
      select space_id,
        count(*) filter (where type = 'Action')::int as action_count,
        count(*) filter (where type = 'Impact')::int as impact_count
      from coherences
      where shared_with_network = true
        and type in ('Action', 'Impact')
        and coalesce(archived, false) = false
      group by space_id
    ) counts on counts.space_id = s.id
    where c.shared_with_network = true
      and c.type = 'Need'
      and coalesce(c.archived, false) = false
      and s.is_archived = false
      and c.slug is not null
    order by c.updated_at desc
    limit 60
  `);
  const drafts: Array<
    Omit<NetworkOpenNeed, 'capital' | 'spaceSeeks' | 'spaceOffers'> & {
      spaceId: number;
      tagged: string | null;
    }
  > = [];
  for (const row of rowsOf(result)) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const kind = asOpenNeedKind(record.type);
    const slug = typeof record.slug === 'string' ? record.slug : '';
    const spaceSlug =
      typeof record.space_slug === 'string' ? record.space_slug : '';
    const spaceId = Number(record.space_id);
    if (!kind || !slug || !spaceSlug || !Number.isInteger(spaceId)) continue;
    drafts.push({
      spaceId,
      tagged: parseCapitalKeys(asTags(record.tags))[0] ?? null,
      slug,
      title: typeof record.title === 'string' ? record.title : '',
      description:
        typeof record.description === 'string' ? record.description : '',
      type: kind,
      spaceSlug,
      spaceTitle:
        typeof record.space_title === 'string' ? record.space_title : spaceSlug,
      spaceChatRoomId:
        typeof record.chat_room_id === 'string' ? record.chat_room_id : null,
      leadImage:
        typeof record.lead_image === 'string' ? record.lead_image : null,
      updatedAt: asIso(record.updated_at),
      actionCount: asCount(record.action_count),
      impactCount: asCount(record.impact_count),
      spacePlace:
        typeof record.location_label === 'string' ? record.location_label : '',
      spaceDescription:
        typeof record.space_description === 'string'
          ? record.space_description
          : '',
      spaceLeadImage:
        typeof record.space_lead_image === 'string'
          ? record.space_lead_image
          : null,
    });
  }
  const capitals = await readSpaceCapitals(
    db,
    drafts.map((draft) => draft.spaceId),
  );
  return drafts.map(({ spaceId, tagged, ...need }) => ({
    ...need,
    capital: tagged ?? capitals.get(spaceId)?.seeks[0] ?? null,
    spaceSeeks: capitals.get(spaceId)?.seeks ?? [],
    spaceOffers: capitals.get(spaceId)?.offers ?? [],
  }));
}
