import {
  and,
  asc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import {
  memberships,
  people,
  spaceScheduledItemReminderDispatches,
  spaceScheduledItems,
  spaces,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import type { DueScheduledReminder, ScheduledItem } from '../types';
import { expandScheduledOccurrenceStarts } from '../recurrence';
import { REMINDER_MINUTES_OPTIONS } from '../recurrence-presets';

export function mapScheduledItemRow(
  row: typeof spaceScheduledItems.$inferSelect,
): ScheduledItem {
  return {
    id: row.id,
    spaceId: row.spaceId,
    creatorId: row.creatorId,
    title: row.title,
    description: row.description,
    type: row.type,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    timezone: row.timezone,
    location: row.location,
    meetingUrl: row.meetingUrl,
    color: row.color,
    recurrenceRule: row.recurrenceRule,
    recurrenceUntil: row.recurrenceUntil,
    matrixRoomId: row.matrixRoomId,
    matrixAutoLink: row.matrixAutoLink,
    reminderMinutesBefore: row.reminderMinutesBefore,
    coherenceId: row.coherenceId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findScheduledItemsBySpaceId(
  {
    spaceId,
    from,
    to,
    page = 1,
    pageSize = 100,
  }: {
    spaceId: number;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  },
  { db }: DbConfig,
): Promise<{
  items: ScheduledItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const safePageSize = Math.min(500, Math.max(1, pageSize));
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safePageSize;
  const conditions = [eq(spaceScheduledItems.spaceId, spaceId)];

  if (from && to) {
    conditions.push(
      or(
        and(
          isNull(spaceScheduledItems.recurrenceRule),
          gte(spaceScheduledItems.endsAt, from),
          lte(spaceScheduledItems.startsAt, to),
        ),
        and(
          isNotNull(spaceScheduledItems.recurrenceRule),
          lte(spaceScheduledItems.startsAt, to),
          or(
            isNull(spaceScheduledItems.recurrenceUntil),
            gte(spaceScheduledItems.recurrenceUntil, from),
          ),
        ),
      )!,
    );
  } else {
    if (from) {
      conditions.push(gte(spaceScheduledItems.endsAt, from));
    }
    if (to) {
      conditions.push(lte(spaceScheduledItems.startsAt, to));
    }
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(spaceScheduledItems)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(spaceScheduledItems)
    .where(and(...conditions))
    .orderBy(asc(spaceScheduledItems.startsAt))
    .limit(safePageSize)
    .offset(offset);

  return {
    items: rows.map(mapScheduledItemRow),
    total: countRow?.count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function findScheduledItemsByCoherenceId(
  {
    spaceId,
    coherenceId,
    page = 1,
    pageSize = 50,
  }: {
    spaceId: number;
    coherenceId: number;
    page?: number;
    pageSize?: number;
  },
  { db }: DbConfig,
): Promise<{
  items: ScheduledItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safePageSize;
  const conditions = and(
    eq(spaceScheduledItems.spaceId, spaceId),
    eq(spaceScheduledItems.coherenceId, coherenceId),
  );

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(spaceScheduledItems)
    .where(conditions);

  const rows = await db
    .select()
    .from(spaceScheduledItems)
    .where(conditions)
    .orderBy(asc(spaceScheduledItems.startsAt))
    .limit(safePageSize)
    .offset(offset);

  return {
    items: rows.map(mapScheduledItemRow),
    total: countRow?.count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function findScheduledItemById(
  { id }: { id: number },
  { db }: DbConfig,
): Promise<ScheduledItem | null> {
  const [row] = await db
    .select()
    .from(spaceScheduledItems)
    .where(eq(spaceScheduledItems.id, id))
    .limit(1);

  return row ? mapScheduledItemRow(row) : null;
}

export async function findSpaceMemberSlugsBySpaceId(
  { spaceId }: { spaceId: number },
  { db }: DbConfig,
): Promise<string[]> {
  const rows = await db
    .select({ slug: people.slug })
    .from(memberships)
    .innerJoin(people, eq(memberships.personId, people.id))
    .where(eq(memberships.spaceId, spaceId));

  return rows
    .map((row) => row.slug?.trim())
    .filter((slug): slug is string => Boolean(slug));
}

export async function findDueScheduledReminders(
  {
    now = new Date(),
    lookaheadMinutes = 20,
  }: {
    now?: Date;
    lookaheadMinutes?: number;
  },
  { db }: DbConfig,
): Promise<DueScheduledReminder[]> {
  const horizon = new Date(now.getTime() + lookaheadMinutes * 60_000);
  const maxReminderMs = Math.max(...REMINDER_MINUTES_OPTIONS) * 60_000;
  const latestOccurrenceStart = new Date(horizon.getTime() + maxReminderMs);
  const earliestOccurrenceStart = new Date(now.getTime() - maxReminderMs);

  const rows = await db
    .select({
      item: spaceScheduledItems,
      spaceSlug: spaces.slug,
      spaceTitle: spaces.title,
    })
    .from(spaceScheduledItems)
    .innerJoin(spaces, eq(spaceScheduledItems.spaceId, spaces.id))
    .where(
      and(
        isNotNull(spaceScheduledItems.reminderMinutesBefore),
        lte(spaceScheduledItems.startsAt, latestOccurrenceStart),
        or(
          and(
            isNull(spaceScheduledItems.recurrenceRule),
            gte(spaceScheduledItems.startsAt, earliestOccurrenceStart),
          ),
          and(
            isNotNull(spaceScheduledItems.recurrenceRule),
            or(
              isNull(spaceScheduledItems.recurrenceUntil),
              gte(spaceScheduledItems.recurrenceUntil, now),
            ),
          ),
        ),
      ),
    );

  const due: DueScheduledReminder[] = [];

  for (const row of rows) {
    const item = mapScheduledItemRow(row.item);
    const minutes = item.reminderMinutesBefore;
    if (minutes == null) continue;

    const occurrenceFrom = new Date(now.getTime() + minutes * 60_000);
    const occurrenceTo = new Date(horizon.getTime() + minutes * 60_000);

    const occurrenceStarts = expandScheduledOccurrenceStarts({
      startsAt: item.startsAt,
      recurrenceRule: item.recurrenceRule,
      recurrenceUntil: item.recurrenceUntil,
      from: occurrenceFrom,
      to: occurrenceTo,
      timezone: item.timezone,
    });

    for (const occurrenceStartsAt of occurrenceStarts) {
      const reminderAt = new Date(
        occurrenceStartsAt.getTime() - minutes * 60_000,
      );
      if (reminderAt < now || reminderAt > horizon) continue;

      due.push({
        item,
        occurrenceStartsAt,
        spaceSlug: row.spaceSlug,
        spaceTitle: row.spaceTitle,
        channels: ['email', 'push'],
      });
    }
  }

  return due;
}

export async function hasScheduledReminderBeenDispatched(
  {
    scheduledItemId,
    occurrenceStartsAt,
    channel,
  }: {
    scheduledItemId: number;
    occurrenceStartsAt: Date;
    channel: 'email' | 'push';
  },
  { db }: DbConfig,
): Promise<boolean> {
  const [row] = await db
    .select({ id: spaceScheduledItemReminderDispatches.id })
    .from(spaceScheduledItemReminderDispatches)
    .where(
      and(
        eq(
          spaceScheduledItemReminderDispatches.scheduledItemId,
          scheduledItemId,
        ),
        eq(
          spaceScheduledItemReminderDispatches.occurrenceStartsAt,
          occurrenceStartsAt,
        ),
        eq(spaceScheduledItemReminderDispatches.channel, channel),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function tryClaimScheduledReminderDispatch(
  {
    scheduledItemId,
    occurrenceStartsAt,
    channel,
  }: {
    scheduledItemId: number;
    occurrenceStartsAt: Date;
    channel: 'email' | 'push';
  },
  { db }: DbConfig,
): Promise<boolean> {
  const [row] = await db
    .insert(spaceScheduledItemReminderDispatches)
    .values({
      scheduledItemId,
      occurrenceStartsAt,
      channel,
    })
    .onConflictDoNothing({
      target: [
        spaceScheduledItemReminderDispatches.scheduledItemId,
        spaceScheduledItemReminderDispatches.occurrenceStartsAt,
        spaceScheduledItemReminderDispatches.channel,
      ],
    })
    .returning();

  return Boolean(row);
}

export async function releaseScheduledReminderDispatch(
  {
    scheduledItemId,
    occurrenceStartsAt,
    channel,
  }: {
    scheduledItemId: number;
    occurrenceStartsAt: Date;
    channel: 'email' | 'push';
  },
  { db }: DbConfig,
) {
  await db
    .delete(spaceScheduledItemReminderDispatches)
    .where(
      and(
        eq(
          spaceScheduledItemReminderDispatches.scheduledItemId,
          scheduledItemId,
        ),
        eq(
          spaceScheduledItemReminderDispatches.occurrenceStartsAt,
          occurrenceStartsAt,
        ),
        eq(spaceScheduledItemReminderDispatches.channel, channel),
      ),
    );
}

export async function recordScheduledReminderDispatch(
  {
    scheduledItemId,
    occurrenceStartsAt,
    channel,
  }: {
    scheduledItemId: number;
    occurrenceStartsAt: Date;
    channel: 'email' | 'push';
  },
  { db }: DbConfig,
) {
  await db
    .insert(spaceScheduledItemReminderDispatches)
    .values({
      scheduledItemId,
      occurrenceStartsAt,
      channel,
    })
    .onConflictDoNothing({
      target: [
        spaceScheduledItemReminderDispatches.scheduledItemId,
        spaceScheduledItemReminderDispatches.occurrenceStartsAt,
        spaceScheduledItemReminderDispatches.channel,
      ],
    });
}
