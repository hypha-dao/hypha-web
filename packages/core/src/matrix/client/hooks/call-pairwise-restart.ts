type LocalCallFeedLike = {
  stream?: MediaStream | null;
  isVideoMuted?: () => boolean;
  isAudioMuted?: () => boolean;
};

type MatrixCallRestartLike = {
  hangup?: () => void;
  callHasEnded?: () => boolean;
  getOpponentMember?: () => { userId?: string } | null;
  updateLocalUsermediaStream?: (
    stream: MediaStream,
    forceAudio?: boolean,
    forceVideo?: boolean,
  ) => Promise<void>;
  upgradeCall?: (audio: boolean, video: boolean) => Promise<void>;
  setLocalVideoMuted?: (muted: boolean) => Promise<unknown>;
  isLocalVideoMuted?: () => boolean;
  hasUserMediaVideoSender?: boolean;
  localUsermediaFeed?: {
    setAudioVideoMuted?: (
      audioMuted: boolean | null,
      videoMuted: boolean | null,
    ) => void;
  };
  sendMetadataUpdate?: () => Promise<void>;
};

type GroupCallCallsLike = {
  localCallFeed?: LocalCallFeedLike;
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

function resolvePairwisePublishFlags(feed: LocalCallFeedLike | undefined): {
  wantAudio: boolean;
  wantVideo: boolean;
} {
  return {
    wantAudio: !(feed?.isAudioMuted?.() ?? false),
    wantVideo: !(feed?.isVideoMuted?.() ?? true),
  };
}

/**
 * matrix-js-sdk `MatrixCall.updateLocalUsermediaStream(stream)` without
 * `forceVideo` leaves outbound video tracks disabled when the per-call feed was
 * cloned from an audio-first session (`callFeed.isVideoMuted() === true`).
 */
async function pushStreamToMatrixCall(
  call: MatrixCallRestartLike,
  stream: MediaStream,
  flags: { wantAudio: boolean; wantVideo: boolean },
): Promise<void> {
  if (call.callHasEnded?.()) return;

  const needsVideoUpgrade =
    flags.wantVideo &&
    (call.isLocalVideoMuted?.() === true ||
      call.hasUserMediaVideoSender === false);

  if (needsVideoUpgrade) {
    if (typeof call.upgradeCall === 'function') {
      await call.upgradeCall(false, true).catch(() => undefined);
    } else if (typeof call.setLocalVideoMuted === 'function') {
      await call.setLocalVideoMuted(false).catch(() => undefined);
    }
  }

  call.localUsermediaFeed?.setAudioVideoMuted?.(
    flags.wantAudio ? false : null,
    flags.wantVideo ? false : null,
  );

  if (typeof call.updateLocalUsermediaStream === 'function') {
    await call
      .updateLocalUsermediaStream(stream, flags.wantAudio, flags.wantVideo)
      .catch(() => undefined);
  }

  if (flags.wantAudio || flags.wantVideo) {
    await call.sendMetadataUpdate?.().catch(() => undefined);
  }
}

/** Per pairwise call — new MatrixCall sessions must receive local A/V even when the stream fingerprint is unchanged. */
const lastPublishedFingerprintByCall = new Map<MatrixCallRestartLike, string>();

export function resetPairwiseRepublishFingerprintForTests(): void {
  lastPublishedFingerprintByCall.clear();
}

export function hasActivePairwiseCalls(gc: unknown): boolean {
  let active = false;
  forEachGroupCallMatrixCall(gc, (call) => {
    if (!call.callHasEnded?.()) active = true;
  });
  return active;
}

/** Hang up every live pairwise session so `placeOutgoingCalls()` can rebuild with video. */
export function hangupAllActivePairwiseCalls(gc: unknown): number {
  let hungUp = 0;
  forEachGroupCallMatrixCall(gc, (call) => {
    if (call.callHasEnded?.()) {
      lastPublishedFingerprintByCall.delete(call);
      return;
    }
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

export async function restartAllPairwiseCallsForVideo(
  gc: unknown,
  nudgePlaceOutgoing: () => void,
): Promise<number> {
  const hungUp = hangupAllActivePairwiseCalls(gc);
  nudgePlaceOutgoing();
  await republishLocalMediaToPairwiseCalls(gc, { force: true });
  return hungUp;
}

const PAIRWISE_VIDEO_RESYNC_DEBOUNCE_MS = 5_000;
let pairwiseVideoResyncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPairwiseVideoResync: {
  gc: unknown;
  nudgePlaceOutgoing: () => void;
} | null = null;

export function clearPairwiseVideoResyncSchedule(): void {
  if (pairwiseVideoResyncTimer != null) {
    clearTimeout(pairwiseVideoResyncTimer);
    pairwiseVideoResyncTimer = null;
  }
  pendingPairwiseVideoResync = null;
}

export function resetPairwiseVideoResyncScheduleForTests(): void {
  clearPairwiseVideoResyncSchedule();
}

/**
 * Debounced full pairwise restart — initial `placeOutgoingCalls()` often runs
 * before the local camera track exists, leaving audio-only SDP on both sides.
 */
export function schedulePairwiseVideoResync(
  gc: unknown,
  nudgePlaceOutgoing: () => void,
  delayMs = PAIRWISE_VIDEO_RESYNC_DEBOUNCE_MS,
): void {
  if (typeof setTimeout === 'undefined') return;
  pendingPairwiseVideoResync = { gc, nudgePlaceOutgoing };
  if (pairwiseVideoResyncTimer != null) {
    clearTimeout(pairwiseVideoResyncTimer);
  }
  pairwiseVideoResyncTimer = setTimeout(() => {
    pairwiseVideoResyncTimer = null;
    const pending = pendingPairwiseVideoResync;
    pendingPairwiseVideoResync = null;
    if (!pending) return;
    void restartAllPairwiseCallsForVideo(
      pending.gc,
      pending.nudgePlaceOutgoing,
    ).catch(() => undefined);
  }, delayMs);
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

  const publishFlags = resolvePairwisePublishFlags(groupCall.localCallFeed);
  const fingerprint = [
    streamRepublishFingerprint(stream),
    publishFlags.wantAudio ? 'a1' : 'a0',
    publishFlags.wantVideo ? 'v1' : 'v0',
  ].join('|');

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
      pushStreamToMatrixCall(call, stream, publishFlags).then(() => {
        lastPublishedFingerprintByCall.set(call, fingerprint);
      }),
    );
  });
  await Promise.all(tasks);
  return updated;
}
