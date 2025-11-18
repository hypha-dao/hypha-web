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

  const res = await db
    .select({
      name: people.name,
      surname: people.surname,
      avatarUrl: people.avatarUrl,
      address: people.address,
      total: sql<number>`cast(count(*) over() as integer)`,
    })
    .from(people)
    .where(inArray(sql<string>`upper(${people.address})`, upperAddresses))
    .limit(pageSize)
    .offset(offset)
    .groupBy(people.name, people.surname, people.avatarUrl, people.address);

  const total = res.at(0)?.total ?? 0;
  const data = res.map(({ total, ...rest }) => ({ ...rest }));

  return {
    data,
    meta: {
      total,
      limit: pageSize,
      offset,
    },
  };
}
