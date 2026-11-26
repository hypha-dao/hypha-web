import { check, text, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * The closed list of origin kinds (#2724). A new kind needs a migration that widens the CHECK.
 * `packages/core/src/origin/kinds.ts` mirrors this list for application code; a core test
 * asserts the two lists are identical.
 */
export const ORIGIN_KINDS = [
  'app',
  'hypha_assistant',
  'mcp_client',
  'api_client',
  'space_key',
  'hypha_intelligence',
  'hypha_platform',
  'unknown',
] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

/** Kinds that carry no client id and no client label. */
export const CLIENT_LESS_ORIGIN_KINDS = [
  'app',
  'unknown',
  'hypha_assistant',
] as const satisfies readonly OriginKind[];

/** Kinds that must carry a stable client id. */
export const CLIENT_ID_REQUIRED_ORIGIN_KINDS = [
  'mcp_client',
  'api_client',
  'space_key',
] as const satisfies readonly OriginKind[];

export const ORIGIN_CLIENT_ID_MAX = 255;
export const ORIGIN_CLIENT_LABEL_MAX = 120;

const quoted = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * Server-set, never-edited record of which path created a row. Written once by the data layer
 * from an `Origin` (see `packages/core/src/origin`); no update path includes these columns.
 *
 * No default: a write without an origin fails. Rows written before the origin existed were
 * filled with 'unknown' by migration 0105; 0106 dropped that default.
 */
export const originColumns = {
  originKind: text('origin_kind').notNull(),
  originClientId: varchar('origin_client_id', { length: ORIGIN_CLIENT_ID_MAX }),
  originClientLabel: varchar('origin_client_label', {
    length: ORIGIN_CLIENT_LABEL_MAX,
  }),
};

type OriginTable = {
  originKind: PgColumn;
  originClientId: PgColumn;
  originClientLabel: PgColumn;
};

/** The CHECK constraints for a table that spreads `originColumns`. */
export function originChecks(table: OriginTable, tableName: string) {
  return [
    check(
      `${tableName}_origin_kind_check`,
      sql`${table.originKind} IN (${quoted(ORIGIN_KINDS)})`,
    ),
    check(
      `${tableName}_origin_client_check`,
      sql`(${table.originKind} NOT IN (${quoted(
        CLIENT_LESS_ORIGIN_KINDS,
      )}) OR (${table.originClientId} IS NULL AND ${
        table.originClientLabel
      } IS NULL)) AND (${table.originKind} NOT IN (${quoted(
        CLIENT_ID_REQUIRED_ORIGIN_KINDS,
      )}) OR ${table.originClientId} IS NOT NULL) AND (${
        table.originClientId
      } IS NULL OR length(btrim(${
        table.originClientId
      })) BETWEEN 1 AND ${sql.raw(String(ORIGIN_CLIENT_ID_MAX))}) AND (${
        table.originClientLabel
      } IS NULL OR length(btrim(${
        table.originClientLabel
      })) BETWEEN 1 AND ${sql.raw(String(ORIGIN_CLIENT_LABEL_MAX))})`,
    ),
  ];
}
