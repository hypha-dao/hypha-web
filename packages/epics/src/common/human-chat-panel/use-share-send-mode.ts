'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ParticipantEvent,
  Track,
  type LocalTrackPublication,
  type LocalVideoTrack,
  type Room,
} from 'livekit-client';

import {
  CALL_SHARE_SEND_MODE_DEFAULT,
  shareEncodingsForMode,
  shareModeFromEncodings,
  topEncodingIndex,
  type CallShareSendMode,
  type ShareTopEncoding,
} from './call-share-send-mode';

/**
 * Sharer's Detail / Smooth choice for the running screenshare (#2742). Kept per publication sid in
 * a module store so it survives toolbar remounts (dock <-> full view <-> Document PiP) and resets to
 * Detail with a new share, which is published with today's options again.
 */

type SendModeState = {
  mode: CallShareSendMode;
  pending: CallShareSendMode | null;
  /** The last switch did not take; the share stays on `mode`. */
  failed: boolean;
  /** Top-layer values at publish time, so Detail restores exactly today's share. */
  detailTop?: ShareTopEncoding;
};

const stateBySid = new Map<string, SendModeState>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const l of listeners) l();
}

function patch(sid: string, next: Partial<SendModeState>) {
  const prev = stateBySid.get(sid) ?? {
    mode: CALL_SHARE_SEND_MODE_DEFAULT,
    pending: null,
    failed: false,
  };
  stateBySid.set(sid, { ...prev, ...next });
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetShareSendModeStoreForTests(): void {
  stateBySid.clear();
  emit();
}

/** Switches the running share's top layer; resolves to the mode actually in effect afterwards. */
export async function applyShareSendMode(
  track: LocalVideoTrack,
  sid: string,
  mode: CallShareSendMode,
): Promise<CallShareSendMode | undefined> {
  const sender = track.sender;
  if (!sender) return undefined;
  const state = stateBySid.get(sid);
  let detailTop = state?.detailTop;

  const attempt = async () => {
    const params = sender.getParameters();
    if (!params.encodings?.length) return;
    if (!detailTop) {
      // First switch of this share: the sender still has its publish-time (Detail) values.
      const top = params.encodings[topEncodingIndex(params.encodings)];
      detailTop = {
        maxFramerate: top?.maxFramerate,
        maxBitrate: top?.maxBitrate,
      };
      patch(sid, { detailTop });
    }
    params.encodings = shareEncodingsForMode(params.encodings, mode, detailTop);
    await sender.setParameters(params);
  };

  try {
    await attempt();
  } catch {
    // A concurrent dynacast layer update can invalidate the parameters; one retry with fresh ones.
    try {
      await attempt();
    } catch {
      // Reported through the read-back below.
    }
  }
  if (!detailTop) return undefined;
  return shareModeFromEncodings(
    sender.getParameters().encodings ?? [],
    detailTop,
  );
}

function localScreenSharePublication(
  room: Room | null | undefined,
): LocalTrackPublication | undefined {
  return room?.localParticipant.getTrackPublication(Track.Source.ScreenShare);
}

export type ShareSendModeControl = {
  /** A local screenshare with a sender is running. */
  available: boolean;
  mode: CallShareSendMode;
  pending: CallShareSendMode | null;
  failed: boolean;
  setMode: (mode: CallShareSendMode) => void;
};

export function useShareSendMode(
  room: Room | null | undefined,
  isScreensharing: boolean,
): ShareSendModeControl {
  const [, setPublicationVersion] = useState(0);
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );

  // Re-read the publication when the local share is (un)published; it lands after `isScreensharing`.
  useEffect(() => {
    const participant = room?.localParticipant;
    if (!participant) return;
    const bump = () => setPublicationVersion((v) => v + 1);
    participant.on(ParticipantEvent.LocalTrackPublished, bump);
    participant.on(ParticipantEvent.LocalTrackUnpublished, bump);
    return () => {
      participant.off(ParticipantEvent.LocalTrackPublished, bump);
      participant.off(ParticipantEvent.LocalTrackUnpublished, bump);
    };
  }, [room]);

  const publication = isScreensharing
    ? localScreenSharePublication(room)
    : undefined;
  const sid = publication?.trackSid;
  const track = publication?.videoTrack;
  const state = sid ? stateBySid.get(sid) : undefined;

  const setMode = useCallback(
    (mode: CallShareSendMode) => {
      if (!sid || !track) return;
      const current = stateBySid.get(sid);
      if (current?.pending) return;
      if ((current?.mode ?? CALL_SHARE_SEND_MODE_DEFAULT) === mode) return;
      patch(sid, { pending: mode, failed: false });
      void applyShareSendMode(track, sid, mode).then((inEffect) => {
        const previous =
          stateBySid.get(sid)?.mode ?? CALL_SHARE_SEND_MODE_DEFAULT;
        patch(sid, {
          pending: null,
          mode: inEffect ?? previous,
          failed: inEffect !== mode,
        });
      });
    },
    [sid, track],
  );

  return {
    available: Boolean(sid && track?.sender),
    mode: state?.mode ?? CALL_SHARE_SEND_MODE_DEFAULT,
    pending: state?.pending ?? null,
    failed: state?.failed ?? false,
    setMode,
  };
}
