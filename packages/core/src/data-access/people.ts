import 'server-only';

import { findPersonBySub as findPersonBySubQuery } from '../people/server/queries';
import { connectionFor } from './connection';
import type { DataRequest } from './types';

export function findPersonBySub(
  request: DataRequest,
  input: Parameters<typeof findPersonBySubQuery>[0],
) {
  return findPersonBySubQuery(input, { db: connectionFor(request) });
}
