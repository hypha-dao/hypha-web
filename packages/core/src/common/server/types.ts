import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { schema } from '@hypha-platform/storage-postgres';

export type DatabaseInstance =
  | NodePgDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

/** Drivers whose `transaction()` is supported. neon-http throws. */
export type TransactionalDatabase =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>;

export type DbConfig = {
  db: DatabaseInstance;
};
