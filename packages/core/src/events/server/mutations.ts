import { events } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';
import { CreateEventInput } from '../types';

export const createEvent = async (
  event: CreateEventInput,
  { db }: DbConfig,
) => {
  const insertData = {
    ...event,
    createdAt: new Date(),
  };
  const [dbEvent] = await db.insert(events).values(insertData).returning();
  if (!dbEvent) {
    throw new Error('Failed to create event');
  }

  return dbEvent;
};
