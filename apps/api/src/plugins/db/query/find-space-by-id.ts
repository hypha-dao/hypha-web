import { eq } from 'drizzle-orm';
import { schema, spaces } from '../schema';
import type { DbConfig } from './type';

export async function findSpaceById(
  { id }: { id: number },
  { db }: DbConfig<typeof schema>,
) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, id));

  return space;
}
