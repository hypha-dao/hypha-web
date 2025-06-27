import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from './schema';
import path from 'node:path';

const migrationsFolder = path.join(__dirname, '../migrations');

async function applyMigrations(db: NodePgDatabase<typeof schema>) {
  await migrate(db, {
    migrationsFolder,
  });
}

export { applyMigrations };
