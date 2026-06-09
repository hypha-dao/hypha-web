/** CSH-MESH-1 — delayed `placeOutgoingCalls` nudges after join (pairwise WebRTC races). */
export const PLACE_OUTGOING_RETRY_BASE_MS = [
  1500, 4000, 8000, 12000, 20_000,
] as const;

export const PLACE_OUTGOING_RETRY_EXTENDED_MS = 20_000;

/** When `false`, drops the final 20s nudge (diagnostics / noisy environments). */
export function isCallPairwiseRetry20sEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CALL_PAIRWISE_RETRY_20S !== 'false';
}

export function resolvePlaceOutgoingRetryDelaysMs(): readonly number[] {
  if (isCallPairwiseRetry20sEnabled()) {
    return PLACE_OUTGOING_RETRY_BASE_MS;
  }
  return PLACE_OUTGOING_RETRY_BASE_MS.filter(
    (ms) => ms !== PLACE_OUTGOING_RETRY_EXTENDED_MS,
  );
}
