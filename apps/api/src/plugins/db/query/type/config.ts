import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type DbConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = {
  db: NodePgDatabase<TSchema> | NeonHttpDatabase<TSchema>;
};
