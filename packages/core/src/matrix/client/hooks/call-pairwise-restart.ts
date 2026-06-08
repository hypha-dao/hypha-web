type MatrixCallRestartLike = {
  hangup?: () => void;
  callHasEnded?: () => boolean;
  getOpponentMember?: () => { userId?: string } | null;
  updateLocalUsermediaStream?: (stream: MediaStream) => Promise<void>;
};

type GroupCallCallsLike = {
  localCallFeed?: { stream?: MediaStream | null };
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

function streamRepublishFingerprint(stream: MediaStream): string {
  return [
    stream.id,
    ...stream
      .getTracks()
      .map(
        (track) =>
          `${track.kind}:${track.id}:${track.readyState}:${track.muted}:${track.enabled}`,
      ),
  ].join('|');
}

/** Per pairwise call — new MatrixCall sessions must receive local A/V even when the stream fingerprint is unchanged. */
const lastPublishedFingerprintByCall = new Map<MatrixCallRestartLike, string>();

export function resetPairwiseRepublishFingerprintForTests(): void {
  lastPublishedFingerprintByCall.clear();
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
      lastPublishedFingerprintByCall.delete(call);
      hungUp += 1;
    } catch {
      /* best-effort */
    }
  });
  return hungUp;
}

/**
 * matrix-js-sdk `GroupCall.updateLocalUsermediaStream()` updates the local feed
 * only — it does not push new tracks into active pairwise peer connections. After
 * the callee answers before camera warms up, the caller never receives video until
 * each `MatrixCall` is updated explicitly.
 */
export async function republishLocalMediaToPairwiseCalls(
  gc: unknown,
  options?: { force?: boolean },
): Promise<number> {
  const groupCall = gc as GroupCallCallsLike;
  const stream = groupCall.localCallFeed?.stream ?? null;
  if (!stream || stream.getTracks().length === 0) return 0;

  const fingerprint = streamRepublishFingerprint(stream);

  const tasks: Promise<void>[] = [];
  let updated = 0;
  forEachGroupCallMatrixCall(groupCall, (call) => {
    if (call.callHasEnded?.()) {
      lastPublishedFingerprintByCall.delete(call);
      return;
    }
    if (typeof call.updateLocalUsermediaStream !== 'function') return;
    const last = lastPublishedFingerprintByCall.get(call);
    if (!options?.force && last === fingerprint) return;
    updated += 1;
    tasks.push(
      call
        .updateLocalUsermediaStream(stream)
        .then(() => {
          lastPublishedFingerprintByCall.set(call, fingerprint);
        })
        .catch(() => undefined),
    );
  });
  await Promise.all(tasks);
  return updated;
}
