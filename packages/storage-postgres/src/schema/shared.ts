import { sql } from 'drizzle-orm';
import { integer, timestamp } from 'drizzle-orm/pg-core';

export const commonDateFields = {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity({ startWith: 1000 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};
