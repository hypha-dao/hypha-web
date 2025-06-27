import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Database } from '..';
import { sql } from 'drizzle-orm';
import { schema } from '../schema';

export const resetIndexes = async (
  db: NodePgDatabase<typeof schema> | Database,
) => {
  const tables = ['documents', 'memberships', 'people', 'spaces'].map(
    async (table) => {
      await db.execute(
        sql`SELECT setval(${
          table + '_id_seq'
        }::regclass, COALESCE((SELECT MAX(id) FROM ${sql.identifier(
          table,
        )}), 1000));`,
      );
    },
  );
  await Promise.all(tables);
};
