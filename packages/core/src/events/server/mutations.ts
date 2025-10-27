import { events, Event } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

export const createEvent = async (event: Event, { db }: DbConfig) => {
  const insertData = {
    ...event,
    createdAt: new Date(),
  };
  const [dbPerson] = await db.insert(events).values(insertData).returning();
  if (!dbPerson) {
    throw new Error('Failed to create event');
  }

  return dbPerson;
};
