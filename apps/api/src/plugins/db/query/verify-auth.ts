import { sql } from 'drizzle-orm';
import { schema } from '../schema';
import type { DbConfig } from './type';

export async function verifyAuth({ db }: DbConfig<typeof schema>) {
  try {
    const { rows } = await db.execute(
      sql<{ user_id: string }>`SELECT auth.user_id() as user_id`,
    );
    const user_id = rows[0]?.user_id;

    return !!user_id;
  } catch {
    return false;
  }
}
