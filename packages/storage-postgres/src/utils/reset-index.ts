import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Database } from '..';
import { sql } from 'drizzle-orm';
import { schema } from '../schema';
export const resetIndexes = async (
  db: NodePgDatabase<typeof schema> | Database,
) => {
  const tables = [
    'document_state_transitions',
    'document_discussions',
    'document_proposals',
    'document_votes',
    'document_agreement_signatures',
    'document_agreements',
    'documents',
    'memberships',
    'people',
    'spaces',
  ].map(async (table) => {
    await db.execute(
      sql`SELECT setval(${table + '_id_seq'}::regclass, COALESCE((SELECT MAX(id) FROM ${sql.identifier(table)}), 1000));`,
    );
  });
  await Promise.all(tables);
};
