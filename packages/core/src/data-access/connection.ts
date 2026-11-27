import 'server-only';

import { db } from '@hypha-platform/storage-postgres';
import type { DataRequest } from './types';

/** A connection that supports transactions (the pool driver). */
export type Connection = typeof db;

/**
 * The one resolver: maps a request (who is acting, and in which namespace) to the database
 * connection its data functions run on. Today every request gets the server connection and the
 * rules are enforced in code. A connection under the person's own identity, or one per
 * namespace, plugs in here and nowhere else.
 */
export function connectionFor(_request: DataRequest): Connection {
  void _request;
  return db;
}
