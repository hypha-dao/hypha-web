import 'server-only';

import { sql } from 'drizzle-orm';
import {
  documents,
  events,
  memberships,
  spaces,
  tokens,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { normalizeProposalDocumentLabel } from '../../governance/proposal-document-label';
import {
  parseNetworkDashboardPayload,
  type NetworkDashboardStats,
} from '../network-dashboard';

function readPayload(result: unknown): unknown {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && 'rows' in result
    ? (result as { rows: unknown }).rows
    : undefined;
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined;
  }
  const first = rows[0];
  if (first && typeof first === 'object' && 'payload' in first) {
    return first.payload;
  }
  return undefined;
}

export async function findNetworkDashboardStats({
  db,
}: DbConfig): Promise<NetworkDashboardStats> {
  const result = await db.execute(sql`
    WITH real_spaces AS (
      SELECT
        ${spaces.id} AS id,
        ${spaces.createdAt} AS created_at,
        ${spaces.latitude} AS latitude,
        ${spaces.longitude} AS longitude
      FROM ${spaces}
      WHERE ${spaces.isArchived} = false
        AND NOT (${spaces.flags} @> '["sandbox"]'::jsonb)
        AND NOT (${spaces.flags} @> '["archived"]'::jsonb)
        AND ${spaces.title} NOT ILIKE ${'%test%'}
        AND ${spaces.slug} NOT ILIKE ${'%test%'}
    ),
    real_documents AS (
      SELECT
        ${documents.id} AS id,
        ${documents.createdAt} AS created_at,
        ${documents.state} AS state,
        ${documents.label} AS label
      FROM ${documents}
      INNER JOIN real_spaces ON real_spaces.id = ${documents.spaceId}
      WHERE coalesce(${documents.title}, '') NOT ILIKE ${'%test%'}
        AND ${documents.state} IN ('proposal', 'agreement')
    )
    SELECT json_build_object(
      'spaceCount', (SELECT count(*)::int FROM real_spaces),
      'activeSpaceCount', (
        SELECT count(DISTINCT ${events.referenceId})::int
        FROM ${events}
        INNER JOIN real_spaces ON real_spaces.id = ${events.referenceId}
        WHERE ${events.referenceEntity} = 'space'
          AND ${events.createdAt} >= now() - interval '3 months'
      ),
      'memberCount', (
        SELECT count(DISTINCT ${memberships.personId})::int
        FROM ${memberships}
        INNER JOIN real_spaces ON real_spaces.id = ${memberships.spaceId}
      ),
      'proposalCount', (
        SELECT count(*)::int FROM real_documents WHERE state = 'proposal'
      ),
      'agreementCount', (
        SELECT count(*)::int FROM real_documents WHERE state = 'agreement'
      ),
      'tokenCount', (
        SELECT count(*)::int
        FROM ${tokens}
        INNER JOIN real_spaces ON real_spaces.id = ${tokens.spaceId}
        WHERE ${tokens.archived} = false
      ),
      'mappedSpaceCount', (
        SELECT count(*)::int
        FROM real_spaces
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ),
      'activityLast24h', (
        SELECT count(*)::int
        FROM ${events}
        INNER JOIN real_spaces ON real_spaces.id = ${events.referenceId}
        WHERE ${events.referenceEntity} = 'space'
          AND ${events.createdAt} >= now() - interval '24 hours'
      ),
      'spacesBeforeWindow', (
        SELECT count(*)::int
        FROM real_spaces
        WHERE created_at < date_trunc('month', now()) - interval '11 months'
      ),
      'membersBeforeWindow', (
        SELECT count(*)::int
        FROM ${memberships}
        INNER JOIN real_spaces ON real_spaces.id = ${memberships.spaceId}
        WHERE ${
          memberships.createdAt
        } < date_trunc('month', now()) - interval '11 months'
      ),
      'proposalsBeforeWindow', (
        SELECT count(*)::int
        FROM real_documents
        WHERE state = 'proposal'
          AND created_at < date_trunc('month', now()) - interval '11 months'
      ),
      'spacesByMonth', (
        SELECT coalesce(json_agg(json_build_object('month', month, 'count', count)), '[]'::json)
        FROM (
          SELECT
            to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
            count(*)::int AS count
          FROM real_spaces
          WHERE created_at >= date_trunc('month', now()) - interval '11 months'
          GROUP BY 1
        ) spaces_by_month
      ),
      'membersByMonth', (
        SELECT coalesce(json_agg(json_build_object('month', month, 'count', count)), '[]'::json)
        FROM (
          SELECT
            to_char(date_trunc('month', ${
              memberships.createdAt
            }), 'YYYY-MM') AS month,
            count(*)::int AS count
          FROM ${memberships}
          INNER JOIN real_spaces ON real_spaces.id = ${memberships.spaceId}
          WHERE ${
            memberships.createdAt
          } >= date_trunc('month', now()) - interval '11 months'
          GROUP BY 1
        ) members_by_month
      ),
      'proposalsByMonth', (
        SELECT coalesce(json_agg(json_build_object('month', month, 'count', count)), '[]'::json)
        FROM (
          SELECT
            to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
            count(*)::int AS count
          FROM real_documents
          WHERE state = 'proposal'
            AND created_at >= date_trunc('month', now()) - interval '11 months'
          GROUP BY 1
        ) proposals_by_month
      ),
      'tokensByType', (
        SELECT coalesce(json_agg(json_build_object(
          'name', token_type,
          'count', token_count
        ) ORDER BY token_count DESC, token_type), '[]'::json)
        FROM (
          SELECT ${tokens.type} AS token_type, count(*)::int AS token_count
          FROM ${tokens}
          INNER JOIN real_spaces ON real_spaces.id = ${tokens.spaceId}
          WHERE ${tokens.archived} = false
          GROUP BY ${tokens.type}
        ) token_types
      ),
      'proposalsByLabel', (
        SELECT coalesce(json_agg(json_build_object(
          'name', proposal_label,
          'count', proposal_count
        ) ORDER BY proposal_count DESC, proposal_label), '[]'::json)
        FROM (
          SELECT btrim(label) AS proposal_label, count(*)::int AS proposal_count
          FROM real_documents
          WHERE state = 'proposal'
            AND nullif(btrim(coalesce(label, '')), '') IS NOT NULL
          GROUP BY 1
          ORDER BY count(*) DESC
          LIMIT 30
        ) proposal_labels
      )
    ) AS payload
  `);

  const payload = readPayload(result);
  return parseNetworkDashboardPayload(payload, {
    canonicalizeProposalLabel: normalizeProposalDocumentLabel,
  });
}
