import { DbConfig } from '../../server';
import { people } from '@hypha-platform/storage-postgres';
import { mapToDomainPerson, personColumns } from './queries';
import { isMissingPrimaryOrientationColumn } from './primary-orientation-column';
import { Person } from '../types';
import { eq, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '../../common/server/types';

type PersonWrite = {
  slug: string;
  email: string | null;
  name?: string;
  surname?: string;
  nickname?: string;
  description?: string;
  location?: string;
  address?: string;
  avatarUrl?: string;
  leadImageUrl?: string;
  preferredCurrency?: string;
  links?: string[];
};

function firstExecuteRow(result: unknown): Record<string, unknown> | undefined {
  const row = Array.isArray(result)
    ? result[0]
    : result && typeof result === 'object' && 'rows' in result
    ? (result as { rows?: unknown[] }).rows?.[0]
    : undefined;
  return row && typeof row === 'object'
    ? (row as Record<string, unknown>)
    : undefined;
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return new Date();
}

function personFromSqlRow(row: Record<string, unknown>) {
  const links = row.links;
  return mapToDomainPerson({
    id: Number(row.id),
    slug: typeof row.slug === 'string' ? row.slug : undefined,
    name: typeof row.name === 'string' ? row.name : null,
    surname: typeof row.surname === 'string' ? row.surname : null,
    email: typeof row.email === 'string' ? row.email : null,
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    leadImageUrl:
      typeof row.lead_image_url === 'string' ? row.lead_image_url : null,
    description: typeof row.description === 'string' ? row.description : null,
    location: typeof row.location === 'string' ? row.location : null,
    nickname: typeof row.nickname === 'string' ? row.nickname : null,
    address: typeof row.web3_address === 'string' ? row.web3_address : null,
    preferredCurrency:
      typeof row.preferred_currency === 'string'
        ? row.preferred_currency
        : null,
    links: Array.isArray(links) ? (links as string[]) : [],
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  });
}

/** Insert without `primary_orientation` so signup works before migration 0080. */
async function insertPersonWithoutOrientation(
  db: DatabaseInstance,
  person: PersonWrite,
) {
  const result = await db.execute(sql`
    insert into people (
      slug, avatar_url, lead_image_url, description, email, location,
      name, surname, nickname, web3_address, preferred_currency, links
    ) values (
      ${person.slug},
      ${person.avatarUrl ?? null},
      ${person.leadImageUrl ?? null},
      ${person.description ?? null},
      ${person.email},
      ${person.location ?? null},
      ${person.name ?? null},
      ${person.surname ?? null},
      ${person.nickname ?? null},
      ${person.address ?? null},
      ${person.preferredCurrency ?? null},
      ${JSON.stringify(person.links ?? [])}::jsonb
    )
    returning id, slug, avatar_url, lead_image_url, description, email,
      location, name, surname, nickname, web3_address, preferred_currency,
      links, created_at, updated_at
  `);
  const row = firstExecuteRow(result);
  if (!row) throw new Error('Failed to create person');
  return personFromSqlRow(row);
}

export type CreatePersonConfig = DbConfig;

type PersonColumnRow = Parameters<typeof mapToDomainPerson>[0];

/**
 * `DatabaseInstance` is a union of drivers. Drizzle drops the generic
 * `.returning(fields)` overload on that union, so the column list is applied
 * with a type assertion. `personColumns()` omits `primary_orientation`, which
 * keeps the write valid before migration 0080.
 */
function returningWithoutOrientation(query: { returning(): unknown }) {
  return (
    query as unknown as {
      returning(
        fields: ReturnType<typeof personColumns>,
      ): Promise<PersonColumnRow[]>;
    }
  ).returning(personColumns());
}

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
  let created: Person;
  try {
    const [dbPerson] = await returningWithoutOrientation(
      db.insert(people).values(insertData),
    );
    if (!dbPerson) {
      throw new Error('Failed to create person');
    }
    created = mapToDomainPerson(dbPerson);
  } catch (error) {
    if (!isMissingPrimaryOrientationColumn(error)) throw error;
    created = await insertPersonWithoutOrientation(db, {
      slug,
      email: person.email || null,
      name: person.name,
      surname: person.surname,
      nickname: person.nickname,
      description: person.description,
      location: person.location,
      address: person.address,
      avatarUrl: person.avatarUrl,
      leadImageUrl: person.leadImageUrl,
      preferredCurrency: person.preferredCurrency,
      links: person.links,
    });
  }
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
  const [dbPerson] = await returningWithoutOrientation(
    db.update(people).set(updateData).where(eq(people.id, person.id)),
  );
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
