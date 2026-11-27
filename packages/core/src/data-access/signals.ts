import 'server-only';

import {
  countSignals as countSignalsQuery,
  selectPersonDisplayNames as selectPersonDisplayNamesQuery,
  selectSignalUpvotes as selectSignalUpvotesQuery,
  selectSignalsPage as selectSignalsPageQuery,
  selectTokenSymbolsByAddress as selectTokenSymbolsByAddressQuery,
  selectTopSignalTags as selectTopSignalTagsQuery,
  summariseSignals as summariseSignalsQuery,
  type SignalFilter,
  type SignalWorkflowView,
} from '../coherence/server/list-signals-queries';
import { readSignalWorkflowConfig as readSignalWorkflowConfigQuery } from '../coherence/server/signal-workflow';
import { createSignalUnlessDuplicate as createSignalUnlessDuplicateQuery } from '../coherence/server/signal-write-store';
import { connectionFor } from './connection';
import type { DataRequest, WriteCtx } from './types';

export function readSignalWorkflowConfig(
  request: DataRequest,
  input: Parameters<typeof readSignalWorkflowConfigQuery>[0],
) {
  return readSignalWorkflowConfigQuery(input, { db: connectionFor(request) });
}

export function selectSignalsPage(
  request: DataRequest,
  args: Parameters<typeof selectSignalsPageQuery>[1],
) {
  return selectSignalsPageQuery({ db: connectionFor(request) }, args);
}

export function countSignals(
  request: DataRequest,
  filter: SignalFilter,
  workflow: SignalWorkflowView,
) {
  return countSignalsQuery({ db: connectionFor(request) }, filter, workflow);
}

export function summariseSignals(
  request: DataRequest,
  filter: SignalFilter,
  workflow: SignalWorkflowView,
) {
  return summariseSignalsQuery(
    { db: connectionFor(request) },
    filter,
    workflow,
  );
}

export function selectTopSignalTags(
  request: DataRequest,
  filter: SignalFilter,
  workflow: SignalWorkflowView,
  limit: number,
) {
  return selectTopSignalTagsQuery(
    { db: connectionFor(request) },
    filter,
    workflow,
    limit,
  );
}

export function selectSignalUpvotes(
  request: DataRequest,
  coherenceIds: number[],
  viewerPersonId: number | null,
) {
  return selectSignalUpvotesQuery(
    { db: connectionFor(request) },
    coherenceIds,
    viewerPersonId,
  );
}

export function selectPersonDisplayNames(
  request: DataRequest,
  personIds: number[],
) {
  return selectPersonDisplayNamesQuery(
    { db: connectionFor(request) },
    personIds,
  );
}

export function selectTokenSymbolsByAddress(
  request: DataRequest,
  addresses: string[],
) {
  return selectTokenSymbolsByAddressQuery(
    { db: connectionFor(request) },
    addresses,
  );
}

/** The write: the origin comes from the write context the edge built, never from the input. */
export function createSignalUnlessDuplicate(
  ctx: WriteCtx,
  signal: Parameters<typeof createSignalUnlessDuplicateQuery>[0],
  duplicate: Parameters<typeof createSignalUnlessDuplicateQuery>[1],
) {
  return createSignalUnlessDuplicateQuery(signal, duplicate, {
    db: connectionFor(ctx),
    origin: ctx.origin,
  });
}
