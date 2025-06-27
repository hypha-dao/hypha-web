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
  const url = authToken ? AUTHENTICATED : ANONYMOUS;
  console.debug('getDb', { url, authToken });

  invariant(url, 'connection string is missing');

  // Create Neon connection with auth token for RLS
  const sql = neon(url, {
    authToken, // This enables RLS with the user's permissions
  });

  // Create drizzle instance with the authenticated connection
  return drizzle(sql, { schema });
};
