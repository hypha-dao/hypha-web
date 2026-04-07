import { DbConfig } from '../../server';
import { people } from '@hypha-platform/storage-postgres';
import { mapToDomainPerson } from './queries';
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
  const [dbPerson] = await db.insert(people).values(insertData).returning();
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
  const [dbPerson] = await db
    .update(people)
    .set(updateData)
    .where(eq(people.id, person.id))
    .returning();
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
