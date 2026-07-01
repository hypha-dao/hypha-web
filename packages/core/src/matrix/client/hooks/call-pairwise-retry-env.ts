/** CSH-MESH-1 — optional 20s `placeOutgoingCalls` nudge (staging diagnostics). */
export const PLACE_OUTGOING_RETRY_BASE_MS = [1500, 4000, 8000, 12000] as const;

export const PLACE_OUTGOING_RETRY_EXTENDED_MS = 20_000;

export function isCallPairwiseRetry20sEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CALL_PAIRWISE_RETRY_20S === 'true';
}

export function resolvePlaceOutgoingRetryDelaysMs(): readonly number[] {
  if (!isCallPairwiseRetry20sEnabled()) {
    return PLACE_OUTGOING_RETRY_BASE_MS;
  }
  return [...PLACE_OUTGOING_RETRY_BASE_MS, PLACE_OUTGOING_RETRY_EXTENDED_MS];
}
