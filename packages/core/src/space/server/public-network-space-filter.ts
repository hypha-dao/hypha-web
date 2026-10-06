import { sql } from 'drizzle-orm';
import { spaces } from '@hypha-platform/storage-postgres';

/**
 * Same title normalize as `isPlaceholderSpaceTitle` / paying-spaces.
 * Keep the regexes in sync with `normalizePayingSpaceTitle`.
 */
export const publicSpaceTitleNormSql = sql`
  btrim(
    regexp_replace(
      regexp_replace(
        ${spaces.title},
        E'[\\u200B-\\u200D\\uFEFF]',
        '',
        'g'
      ),
      E'[\\s\\u00A0\\u202F\\u2007\\u2060]+',
      ' ',
      'g'
    )
  )
`;

/**
 * Public network snapshot space predicate. Drops sandbox / archived-flag /
 * test / empty / `Space N` placeholder titles. Does not require an address.
 */
export const publicNetworkSpacePredicateSql = sql`
  ${spaces.isArchived} = false
    AND NOT (${spaces.flags} @> '["sandbox"]'::jsonb)
    AND NOT (${spaces.flags} @> '["archived"]'::jsonb)
    AND ${spaces.title} NOT ILIKE ${'%test%'}
    AND ${spaces.slug} NOT ILIKE ${'%test%'}
    AND ${publicSpaceTitleNormSql} <> ''
    AND ${publicSpaceTitleNormSql} !~* '^space [0-9]+$'
`;
