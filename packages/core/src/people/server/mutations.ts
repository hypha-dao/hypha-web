import { DbConfig } from '../../server';
import { people } from '@hypha-platform/storage-postgres';
import { mapToDomainPerson, personColumns } from './queries';
import { isMissingPrimaryOrientationColumn } from './primary-orientation-column';
import { Person } from '../types';
import { eq } from 'drizzle-orm';

export type CreatePersonConfig = DbConfig;

export const createPerson = async (
  person: Person,
  { db }: CreatePersonConfig,
) => {
  const slug = person.nickname?.toLowerCase().replace(/\s+/g, '-') || '';
  const { primaryOrientation, ...profile } = person;
  const insertData = {
    ...profile,
    email: person.email || null,
    slug,
  };
  // Returning every schema column includes primary_orientation and fails
  // before migration 0080, which is what blocked "Enter your home".
  const [dbPerson] = await db
    .insert(people)
    .values(insertData)
    .returning(personColumns());
  if (!dbPerson) {
    throw new Error('Failed to create person');
  }

  const created = mapToDomainPerson(dbPerson);
  if (
    primaryOrientation !== 'member' &&
    primaryOrientation !== 'builder' &&
    primaryOrientation !== 'investor'
  ) {
    return created;
  }

  try {
    return await updatePersonPrimaryOrientation(
      { id: created.id, primaryOrientation },
      { db },
    );
  } catch (error) {
    if (isMissingPrimaryOrientationColumn(error)) return created;
    throw error;
  }
};

export const updatePerson = async (
  person: Person,
  { db }: CreatePersonConfig,
) => {
  const slug = person.nickname?.toLowerCase().replace(/\s+/g, '-') || '';
  const { primaryOrientation, ...profile } = person;
  void primaryOrientation;
  const updateData = {
    ...profile,
    email: person.email || null,
    slug,
  };
  const [dbPerson] = await db
    .update(people)
    .set(updateData)
    .where(eq(people.id, person.id))
    .returning(personColumns());
  if (!dbPerson) {
    throw new Error('Failed to update person');
  }
  return mapToDomainPerson(dbPerson);
};

export const updatePersonPrimaryOrientation = async (
  {
    id,
    primaryOrientation,
  }: {
    id: number;
    primaryOrientation: 'member' | 'builder' | 'investor';
  },
  { db }: CreatePersonConfig,
) => {
  const [dbPerson] = await db
    .update(people)
    .set({ primaryOrientation, updatedAt: new Date() })
    .where(eq(people.id, id))
    .returning();
  if (!dbPerson) {
    throw new Error('Failed to update orientation');
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
