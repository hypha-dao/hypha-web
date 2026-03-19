import { sql, inArray } from 'drizzle-orm';
import { schema, spaces } from '../schema';
import type { DbConfig } from './type';

/**
 * @summary Find spaces by its executor addresses
 */
export async function findSpacesByAddresses(
  { addresses }: { addresses: Array<string> },
  { db }: DbConfig<typeof schema>,
) {
  if (addresses.length === 0) return [];

  const uppercasedAddresses = addresses.map((addr) => addr.toUpperCase());

  const found = await db
    .select()
    .from(spaces)
    .where(inArray(sql<string>`upper(${spaces.address})`, uppercasedAddresses));

  return found;
}
