import 'server-only';

import { selectQuestProposalDocuments as selectQuestProposalDocumentsQuery } from '../space-quests/server/list-quests-queries';
import { readQuestsListing as readQuestsListingQuery } from '../space-quests/server/list-quests-read';
import { connectionFor } from './connection';
import type { DataRequest } from './types';

export function readQuestsListing(
  request: DataRequest,
  filter: Parameters<typeof readQuestsListingQuery>[1],
) {
  return readQuestsListingQuery({ db: connectionFor(request) }, filter);
}

export function selectQuestProposalDocuments(
  request: DataRequest,
  documentIds: number[],
) {
  return selectQuestProposalDocumentsQuery(
    { db: connectionFor(request) },
    documentIds,
  );
}
