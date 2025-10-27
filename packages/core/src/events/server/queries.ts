import { asc, eq } from 'drizzle-orm';
import { events } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

type FindAllEventsProps = {
  type?: string;
};

export const findAllEvents = async (
  { db }: DbConfig,
  { type }: FindAllEventsProps = {},
) => {
  const results = await db
    .select({
      id: events.id,
      type: events.type,
      createdAt: events.createdAt,
      referenceId: events.referenceId,
      referenceEntity: events.referenceEntity,
      parameters: events.parameters,
    })
    .from(events)
    .where(type ? eq(events.type, type) : undefined)
    .groupBy(
      events.id,
      events.type,
      events.createdAt,
      events.referenceId,
      events.referenceEntity,
      events.parameters,
    )
    .orderBy(asc(events.id));

  return results;
};
