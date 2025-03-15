import { DbConfig } from '@core/common/server';
import { people } from '@hypha-platform/storage-postgres';
import { mapToDomainPerson } from './queries';
import { Person } from '../types';
import { eq } from 'drizzle-orm';

export type CreatePersonConfig = DbConfig;

export const createPerson = async (
  person: Person,
  { db }: CreatePersonConfig,
) => {
  const [dbPerson] = await db.insert(people).values(person).returning();
  return mapToDomainPerson(dbPerson);
};

export const updatePerson = async (
  person: Person,
  { db }: CreatePersonConfig,
) => {
  const [dbPerson] = await db
    .update(people)
    .set(person)
    .where(eq(people.id, person.id))
    .returning();
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
