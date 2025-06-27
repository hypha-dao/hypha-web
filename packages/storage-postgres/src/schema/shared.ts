import { timestamp } from 'drizzle-orm/pg-core';

export const commonDateFields = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};
