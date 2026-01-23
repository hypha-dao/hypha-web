import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { index, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';

export const matrixUserLinks = pgTable(
  'matrix_user_links',
  {
    id: serial('id').primaryKey(),
    environment: text('environment').notNull(),
    privyUserId: text('privy_user_id').notNull(),
    matrixUserId: text('matrix_user_id').notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    deviceId: text('device_id'),
    ...commonDateFields,
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
  },
  (table) => [
    index('search_index_matrix_user_links').using(
      'gin',
      sql`(
      setweight(to_tsvector('english', ${table.privyUserId}), 'A') ||
      setweight(to_tsvector('english', ${table.matrixUserId}), 'B') ||
      setweight(to_tsvector('english', ${table.encryptedAccessToken}), 'C') ||
      setweight(to_tsvector('english', ${table.deviceId}), 'D') ||
      setweight(to_tsvector('english', ${table.refreshToken}), 'E') ||
      setweight(to_tsvector('english', ${table.environment}), 'F')
    )`,
    ),
  ],
);

export type MatrixUserLink = InferSelectModel<typeof matrixUserLinks>;
export type NewMatrixUserLink = InferInsertModel<typeof matrixUserLinks>;
