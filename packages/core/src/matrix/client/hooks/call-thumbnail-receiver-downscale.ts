export const CALL_THUMBNAIL_DOWNSCALE_MIN_PARTICIPANTS = 5;
export const CALL_THUMBNAIL_DOWNSCALE_FACTOR = 2;

type MatrixCallLike = {
  peerConn?: RTCPeerConnection | null;
  getOpponentMember?: () => { userId?: string } | null;
};

type GroupCallWithCalls = {
  forEachCall?: (callback: (call: MatrixCallLike) => void) => void;
  calls?: Map<string, Map<string, MatrixCallLike>>;
};

export function parseActiveSpeakerUserId(
  activeSpeakerKey: string | null | undefined,
): string | null {
  const key = activeSpeakerKey?.trim();
  if (!key) return null;
  const separator = key.indexOf('::');
  return separator >= 0 ? key.slice(0, separator) : key;
}

export function enumerateGroupCallPeerConnections(
  gc: unknown,
): Array<{ userId: string | null; peerConnection: RTCPeerConnection }> {
  const groupCall = gc as GroupCallWithCalls;
  const connections: Array<{
    userId: string | null;
    peerConnection: RTCPeerConnection;
  }> = [];

  const pushCall = (call: MatrixCallLike) => {
    const peerConnection = call.peerConn ?? null;
    if (!peerConnection) return;
    connections.push({
      userId: call.getOpponentMember?.()?.userId ?? null,
      peerConnection,
    });
  };

  if (typeof groupCall.forEachCall === 'function') {
    groupCall.forEachCall(pushCall);
    return connections;
  }

  for (const deviceMap of groupCall.calls?.values() ?? []) {
    for (const call of deviceMap.values()) {
      pushCall(call);
    }
  }

  return connections;
}

async function setVideoReceiverScale(
  receiver: RTCRtpReceiver,
  scaleResolutionDownBy: number,
): Promise<boolean> {
  if (receiver.track?.kind !== 'video') return false;
  type ReceiverWithDecodeScale = {
    getParameters: () => {
      encodings?: Array<{ scaleResolutionDownBy?: number }>;
    };
    setParameters: (params: {
      encodings: Array<{ scaleResolutionDownBy?: number }>;
    }) => Promise<void>;
  };
  const scalable = receiver as unknown as ReceiverWithDecodeScale;
  if (typeof scalable.setParameters !== 'function') return false;
  const params = scalable.getParameters();
  const encodings =
    params.encodings && params.encodings.length > 0
      ? params.encodings
      : [{ scaleResolutionDownBy }];
  for (const encoding of encodings) {
    encoding.scaleResolutionDownBy = scaleResolutionDownBy;
  }
  await scalable.setParameters({ encodings });
  return true;
}

/**
 * WCUX-QUALITY-4: downscale inbound video on thumbnail receivers when N ≥ 5.
 * Active speaker peer connections keep full resolution (scale 1).
 */
export async function applyCallThumbnailReceiverDownscale(options: {
  gc: unknown;
  participantCount: number;
  activeSpeakerUserId: string | null;
  enabled?: boolean;
}): Promise<{ adjustedReceivers: number }> {
  const { gc, participantCount, activeSpeakerUserId, enabled = true } = options;
  const shouldDownscale =
    enabled && participantCount >= CALL_THUMBNAIL_DOWNSCALE_MIN_PARTICIPANTS;
  let adjustedReceivers = 0;

  for (const { userId, peerConnection } of enumerateGroupCallPeerConnections(
    gc,
  )) {
    const skipForActiveSpeaker =
      shouldDownscale &&
      activeSpeakerUserId != null &&
      userId === activeSpeakerUserId;
    const scale =
      shouldDownscale && !skipForActiveSpeaker
        ? CALL_THUMBNAIL_DOWNSCALE_FACTOR
        : 1;

    for (const receiver of peerConnection.getReceivers()) {
      try {
        const changed = await setVideoReceiverScale(receiver, scale);
        if (changed) adjustedReceivers += 1;
      } catch {
        // Receiver parameters may be read-only until negotiation completes.
      }
    }
  }

  return { adjustedReceivers };
}
