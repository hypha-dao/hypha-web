import { sql, inArray } from 'drizzle-orm';
import { schema, people, type Person } from '../schema';
import type { DbConfig, PaginationParams } from './type';

export interface PeopleByAddressesConfig extends DbConfig<typeof schema> {
  pagination: PaginationParams<Person>;
}

export async function peopleByAddresses(
  { addresses }: { addresses: `0x${string}`[] },
  { db, pagination }: PeopleByAddressesConfig,
) {
  const { pageSize = 20, offset = 0 } = pagination;
  const upperAddresses = addresses.map((addr) => addr.toUpperCase());

  const [resultsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(people)
    .where(inArray(sql<string>`upper(${people.address})`, upperAddresses));
  const total = resultsCount?.count ?? 0;

  const data = await db
    .select({
      name: people.name,
      surname: people.surname,
      avatarUrl: people.avatarUrl,
      address: people.address,
    })
    .from(people)
    .where(inArray(sql<string>`upper(${people.address})`, upperAddresses))
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    meta: {
      total,
      limit: pageSize,
      offset,
    },
  };
}
