import { DbConfig } from '../../server';
import { people } from '@hypha-platform/storage-postgres';
import { getCorePersonFields, mapToDomainPerson } from './queries';
import {
  omitNetworkVisible,
  withOptionalNetworkVisibleColumn,
} from './optional-network-visible';
import { Person } from '../types';
import { eq } from 'drizzle-orm';

export type CreatePersonConfig = DbConfig;

export const createPerson = async (
  person: Person,
  { db }: CreatePersonConfig,
) => {
  const slug = person.nickname?.toLowerCase().replace(/\s+/g, '-') || '';
  const insertData = {
    ...person,
    email: person.email || null,
    slug,
  };
  const [dbPerson] = await withOptionalNetworkVisibleColumn(
    () => db.insert(people).values(insertData).returning(),
    async () => {
      await db.insert(people).values(omitNetworkVisible(insertData));
      return db
        .select(getCorePersonFields())
        .from(people)
        .where(eq(people.slug, slug))
        .limit(1);
    },
  );
  if (!dbPerson) {
    throw new Error('Failed to create person');
  }

  return mapToDomainPerson(dbPerson);
};

export const updatePerson = async (
  person: Person,
  { db }: CreatePersonConfig,
) => {
  const slug = person.nickname?.toLowerCase().replace(/\s+/g, '-') || '';
  const updateData = {
    ...person,
    email: person.email || null,
    slug,
  };
  const [dbPerson] = await withOptionalNetworkVisibleColumn(
    () =>
      db
        .update(people)
        .set(updateData)
        .where(eq(people.id, person.id))
        .returning(),
    async () => {
      await db
        .update(people)
        .set(omitNetworkVisible(updateData))
        .where(eq(people.id, person.id));
      return db
        .select(getCorePersonFields())
        .from(people)
        .where(eq(people.id, person.id))
        .limit(1);
    },
  );
  if (!dbPerson) {
    throw new Error('Failed to update person');
  }
  return mapToDomainPerson(dbPerson);
};

export type DeletePersonInput = {
  id: number;
};
export const deletePerson = async (
  { id }: DeletePersonInput,
  { db }: DbConfig,
) => {
  return await db.delete(people).where(eq(people.id, id));
};
