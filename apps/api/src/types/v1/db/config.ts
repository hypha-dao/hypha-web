import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { schema } from '../../../plugins/db/';

export type DatabaseInstance =
  | NodePgDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

export type DbConfig = {
  db: DatabaseInstance;
};
