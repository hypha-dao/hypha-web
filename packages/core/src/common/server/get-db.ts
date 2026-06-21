import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import invariant from 'tiny-invariant';
import { schema } from '@hypha-platform/storage-postgres';

const AUTHENTICATED = process.env.DEFAULT_DB_AUTHENTICATED_URL!;
const ANONYMOUS = process.env.DEFAULT_DB_ANONYMOUS_URL!;

export type getDbConfig = {
  authToken?: string;
};
export const getDb = ({ authToken }: getDbConfig) => {
  // Preview deploys set BRANCH_DB_URL so migrations run against an isolated Neon
  // branch. Reads use `db` from storage-postgres (same URL); writes through getDb
  // must use the same branch or updates hit a schema without new columns.
  const branchUrl = process.env.BRANCH_DB_URL;
  const url = branchUrl ? branchUrl : authToken ? AUTHENTICATED : ANONYMOUS;
  console.debug('getDb', {
    url,
    hasAuthToken: Boolean(authToken),
    hasBranchUrl: Boolean(branchUrl),
  });

  invariant(url, 'connection string is missing');

  // Create Neon connection with auth token for RLS
  const sql = neon(url, {
    authToken, // This enables RLS with the user's permissions
  });

  // Create drizzle instance with the authenticated connection
  return drizzle(sql, { schema });
};
