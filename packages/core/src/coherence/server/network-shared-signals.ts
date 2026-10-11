import { sql } from 'drizzle-orm';

import type { DatabaseInstance } from '../../common/server/types';
import type {
  NetworkSharedSignal,
  NetworkSignalKind,
  NetworkSpaceRank,
} from '../../network/types';

export type { NetworkSharedSignal, NetworkSignalKind, NetworkSpaceRank };

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
