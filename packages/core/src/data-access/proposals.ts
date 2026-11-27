import 'server-only';

import {
  findProposalDocumentsPage as findProposalDocumentsPageQuery,
  findProposalVoteRefBySlug as findProposalVoteRefBySlugQuery,
} from '../governance/server/queries';
import { connectionFor } from './connection';
import type { DataRequest } from './types';

export function findProposalVoteRefBySlug(
  request: DataRequest,
  input: Parameters<typeof findProposalVoteRefBySlugQuery>[0],
) {
  return findProposalVoteRefBySlugQuery(input, { db: connectionFor(request) });
}

export function findProposalDocumentsPage(
  request: DataRequest,
  input: Parameters<typeof findProposalDocumentsPageQuery>[0],
) {
  return findProposalDocumentsPageQuery(input, { db: connectionFor(request) });
}
