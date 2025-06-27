import { sql } from 'drizzle-orm';

import { DbConfig } from '@hypha-platform/core/server';
import { people, Person as DbPerson } from '@hypha-platform/storage-postgres';
import { Person } from '../types';
import invariant from 'tiny-invariant';

const nullToUndefined = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value;

export const mapToDomainPerson = (dbPerson: Partial<DbPerson>): Person => {
  invariant(dbPerson.slug, 'Person must have a slug');

  return {
    id: dbPerson.id!,
    name: nullToUndefined(dbPerson.name ?? null),
    surname: nullToUndefined(dbPerson.surname ?? null),
    email: nullToUndefined(dbPerson.email ?? null),
    slug: dbPerson.slug,
    sub: undefined,
    avatarUrl: nullToUndefined(dbPerson.avatarUrl ?? null),
    leadImageUrl: nullToUndefined(dbPerson.leadImageUrl ?? null),
    description: nullToUndefined(dbPerson.description ?? null),
    location: nullToUndefined(dbPerson.location ?? null),
    nickname: nullToUndefined(dbPerson.nickname ?? null),
    address: nullToUndefined(dbPerson.address ?? null),
  };
};

export const findSelf = async ({ db }: DbConfig) => {
  try {
    const [dbPerson] = await db
      .select()
      .from(people)
      .where(sql`sub = auth.user_id()`)
      .limit(1);

    if (!dbPerson) {
      return null;
    }

    return mapToDomainPerson(dbPerson);
  } catch (error) {
    console.error('Error finding authenticated user:', error);
    return null;
  }
};

export const verifyAuth = async ({ db }: DbConfig) => {
  try {
    const { rows } = await db.execute(
      sql<{ user_id: string }>`SELECT user_id from auth.user_id()`,
    );
    const user_id = rows[0]?.user_id;
    return !!user_id;
  } catch {
    return false;
  }
};
