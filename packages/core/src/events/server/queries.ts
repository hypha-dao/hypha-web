import { and, asc, eq } from 'drizzle-orm';
import { events } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';
import { EventEntity } from '../types';

type FindAllEventsProps = {
  type?: string;
  referenceId?: number;
  referenceEntity?: EventEntity;
};

export const findAllEvents = async (
  { db }: DbConfig,
  { type, referenceId, referenceEntity }: FindAllEventsProps = {},
) => {
  const whereConditions = [];
  if (type) {
    whereConditions.push(eq(events.type, type));
  }
  if (referenceId) {
    whereConditions.push(eq(events.referenceId, referenceId));
  }
  if (referenceEntity) {
    whereConditions.push(eq(events.referenceEntity, referenceEntity));
  }

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
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
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
