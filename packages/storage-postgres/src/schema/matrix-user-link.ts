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
    index('search_environment').on(table.environment),
    index('search_privy_user_id').on(table.privyUserId),
    index('search_matrix_user_id').on(table.matrixUserId),
    index('search_encrypted_access_token').on(table.encryptedAccessToken),
    index('search_device_id').on(table.deviceId),
    index('search_refresh_token').on(table.refreshToken),
    index('search_token_expires_at').on(table.tokenExpiresAt),
  ],
);

export type MatrixUserLink = InferSelectModel<typeof matrixUserLinks>;
export type NewMatrixUserLink = InferInsertModel<typeof matrixUserLinks>;
