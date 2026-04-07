import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';

export const matrixEnvironmentEnum = pgEnum('matrix_environment', [
  'development',
  'preview',
  'production',
]);

export const matrixUserLinks = pgTable(
  'matrix_user_links',
  {
    id: serial('id').primaryKey(),
    environment: matrixEnvironmentEnum('environment').notNull(),
    privyUserId: text('privy_user_id').notNull(),
    matrixUserId: text('matrix_user_id').notNull(),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    deviceId: text('device_id'),
    ...commonDateFields,
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
  },
  (table) => [
    uniqueIndex('matrix_user_links_env_privy_unique').on(
      table.environment,
      table.privyUserId,
    ),
    uniqueIndex('matrix_user_links_env_matrix_unique').on(
      table.environment,
      table.matrixUserId,
    ),
  ],
);

export type MatrixUserLink = InferSelectModel<typeof matrixUserLinks>;
export type NewMatrixUserLink = InferInsertModel<typeof matrixUserLinks>;
