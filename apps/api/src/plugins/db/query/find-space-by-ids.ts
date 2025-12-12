import { inArray } from 'drizzle-orm';
import { schema, spaces } from '../schema';
import type { DbConfig } from './type';

export async function findSpaceByIds(
  { ids }: { ids: number[] },
  { db }: DbConfig<typeof schema>,
) {
  if (ids.length === 0) return [];

  return await db.select().from(spaces).where(inArray(spaces.id, ids));
}
