import { sql } from 'drizzle-orm';
import { schema, people } from '../schema';
import type { DbConfig } from './type';

export const findPersonByAuth = async ({ db }: DbConfig<typeof schema>) => {
  const [dbPerson] = await db
    .select()
    .from(people)
    .where(sql`sub = auth.user_id()`)
    .limit(1);

  return dbPerson ?? null;
};
