type MatrixCallRestartLike = {
  hangup?: () => void;
  callHasEnded?: () => boolean;
  getOpponentMember?: () => { userId?: string } | null;
};

type GroupCallCallsLike = {
  forEachCall?: (callback: (call: MatrixCallRestartLike) => void) => void;
  calls?: Map<string, Map<string, MatrixCallRestartLike>>;
};

function forEachGroupCallMatrixCall(
  gc: unknown,
  callback: (call: MatrixCallRestartLike) => void,
): void {
  const groupCall = gc as GroupCallCallsLike;
  if (typeof groupCall.forEachCall === 'function') {
    groupCall.forEachCall(callback);
    return;
  }
  for (const deviceMap of groupCall.calls?.values() ?? []) {
    for (const call of deviceMap.values()) {
      callback(call);
    }
  }
}

/**
 * Hang up stuck pairwise `MatrixCall` sessions for specific remote users, then
 * let `placeOutgoingCalls()` rebuild WebRTC without leaving the room GroupCall.
 */
export function hangupPairwiseCallsForRemoteUsers(
  gc: unknown,
  remoteUserIds: readonly string[],
): number {
  const targets = new Set(
    remoteUserIds.map((id) => id?.trim()).filter((id): id is string => !!id),
  );
  if (targets.size === 0) return 0;

  let hungUp = 0;
  forEachGroupCallMatrixCall(gc, (call) => {
    const opponentId = call.getOpponentMember?.()?.userId?.trim();
    if (!opponentId || !targets.has(opponentId)) return;
    if (call.callHasEnded?.()) return;
    if (typeof call.hangup !== 'function') return;
    try {
      call.hangup();
      hungUp += 1;
    } catch {
      /* best-effort */
    }
  });
  return hungUp;
}
