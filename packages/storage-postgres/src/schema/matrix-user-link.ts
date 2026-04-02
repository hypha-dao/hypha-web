import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
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
    uniqueIndex('matrix_user_links_env_privy_unique').on(
      table.environment,
      table.privyUserId,
    ),
    index('search_environment').on(table.environment),
    index('search_privy_user_id').on(table.privyUserId),
    index('search_matrix_user_id').on(table.matrixUserId),
  ],
);

export type MatrixUserLink = InferSelectModel<typeof matrixUserLinks>;
export type NewMatrixUserLink = InferInsertModel<typeof matrixUserLinks>;
