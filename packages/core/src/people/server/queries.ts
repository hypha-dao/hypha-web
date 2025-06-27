import { sql } from 'drizzle-orm';

import { DbConfig } from '@hypha-platform/core/server';

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
