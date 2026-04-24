'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as MatrixSdk from 'matrix-js-sdk';
import { useMatrix } from '../providers/matrix-provider';
import { isPermissionLikeGroupCallError } from './space-group-call-utils';

export type SpaceGroupCallState =
  | 'idle'
  | 'initializing'
  | 'awaiting_media'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type SpaceGroupCallErrorCode =
  | 'NO_CLIENT'
  | 'NO_ROOM'
  | 'NOT_READY'
  | 'PERMISSION_DENIED'
  | 'WEBRTC_FAILED'
  | 'UNKNOWN';

const { GroupCallEvent, GroupCallIntent, GroupCallType, GroupCallState } =
  MatrixSdk;

export function useSpaceGroupCall(roomId: string | null) {
  const { client } = useMatrix();

  const [callState, setCallState] = useState<SpaceGroupCallState>('idle');
  const [errorCode, setErrorCode] = useState<SpaceGroupCallErrorCode | null>(
    null,
  );
  const [threadContext, setThreadContext] = useState<{
    threadRootEventId: string;
  } | null>(null);
  const [callKind, setCallKind] = useState<'audio' | 'video' | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isScreensharing, setIsScreensharing] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] =
    useState<MediaStream | null>(null);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [isLocalVideoMuted, setIsLocalVideoMuted] = useState(true);

  const groupCallRef = useRef<MatrixSdk.GroupCall | null>(null);
  const isJoiningRef = useRef(false);

  const runCleanup = useCallback(() => {
    const gc = groupCallRef.current;
    if (gc) {
      try {
        gc.removeAllListeners(GroupCallEvent.Error);
        gc.removeAllListeners(GroupCallEvent.GroupCallStateChanged);
        gc.removeAllListeners(GroupCallEvent.LocalScreenshareStateChanged);
        gc.removeAllListeners(GroupCallEvent.ParticipantsChanged);
      } catch {
        // ignore
      }
      try {
        gc.leave();
      } catch {
        // ignore
      }
      groupCallRef.current = null;
    }
    isJoiningRef.current = false;
    setLocalPreviewStream(null);
    setIsMicrophoneMuted(false);
    setIsLocalVideoMuted(true);
  }, []);

  const refreshLocalPreview = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc) {
      setLocalPreviewStream(null);
      return;
    }
    const feed = gc.localCallFeed;
    setLocalPreviewStream(feed?.stream ?? null);
  }, []);

  const updateParticipantCount = useCallback(() => {
    const gc = groupCallRef.current;
    if (!gc) {
      setParticipantCount(0);
      return;
    }
    let n = 0;
    for (const [, deviceMap] of gc.participants) {
      n += deviceMap.size;
    }
    setParticipantCount(n);
  }, []);

  const attachGroupCallListeners = useCallback(
    (gc: MatrixSdk.GroupCall) => {
      const onError = (err: unknown) => {
        if (isPermissionLikeGroupCallError(err)) {
          setErrorCode('PERMISSION_DENIED');
        } else {
          setErrorCode('WEBRTC_FAILED');
        }
        setCallState('error');
        runCleanup();
        setCallKind(null);
        setIsScreensharing(false);
        setThreadContext(null);
      };
      gc.on(GroupCallEvent.Error, onError);
      const onState = (
        newState: MatrixSdk.GroupCallState,
        _oldState: MatrixSdk.GroupCallState,
      ) => {
        if (newState === GroupCallState.Entered) {
          setCallState('connected');
          refreshLocalPreview();
          updateParticipantCount();
        }
      };
      gc.on(GroupCallEvent.GroupCallStateChanged, onState);
      gc.on(GroupCallEvent.LocalScreenshareStateChanged, (sharing: boolean) => {
        setIsScreensharing(sharing);
      });
      gc.on(GroupCallEvent.ParticipantsChanged, () => {
        updateParticipantCount();
      });
      gc.on(
        GroupCallEvent.LocalMuteStateChanged,
        (audioMuted: boolean, videoMuted: boolean) => {
          setIsMicrophoneMuted(audioMuted);
          setIsLocalVideoMuted(videoMuted);
        },
      );
    },
    [refreshLocalPreview, runCleanup, updateParticipantCount],
  );

  const enterWithKind = useCallback(
    async (kind: 'audio' | 'video', threadRootEventId?: string) => {
      if (!client || !roomId?.trim()) {
        setErrorCode(!client ? 'NO_CLIENT' : 'NO_ROOM');
        setCallState('error');
        return;
      }
      if (isJoiningRef.current) return;
      if (groupCallRef.current) return;

      isJoiningRef.current = true;
      setErrorCode(null);
      if (threadRootEventId) {
        setThreadContext({ threadRootEventId });
      }
      setCallKind(kind);
      setCallState('initializing');

      try {
        await client.waitUntilRoomReadyForGroupCalls(roomId);
      } catch {
        setErrorCode('NOT_READY');
        setCallState('error');
        setCallKind(null);
        setThreadContext(null);
        isJoiningRef.current = false;
        return;
      }

      const type = kind === 'video' ? GroupCallType.Video : GroupCallType.Voice;
      let gc = client.getGroupCallForRoom(roomId);

      if (!gc) {
        setCallState('connecting');
        try {
          gc = await client.createGroupCall(
            roomId,
            type,
            false,
            GroupCallIntent.Room,
          );
        } catch (e) {
          if (
            e instanceof Error &&
            e.message.includes('already has an existing group call')
          ) {
            gc = client.getGroupCallForRoom(roomId);
          } else {
            isJoiningRef.current = false;
            setErrorCode('UNKNOWN');
            setCallState('error');
            setCallKind(null);
            setThreadContext(null);
            return;
          }
        }
      }

      if (!gc) {
        setErrorCode('UNKNOWN');
        setCallState('error');
        setCallKind(null);
        setThreadContext(null);
        isJoiningRef.current = false;
        return;
      }

      const gci = gc as unknown as {
        initWithVideoMuted: boolean;
        initWithAudioMuted: boolean;
      };
      gci.initWithVideoMuted = kind === 'audio';
      gci.initWithAudioMuted = false;

      groupCallRef.current = gc;
      attachGroupCallListeners(gc);
      setCallState('connecting');

      try {
        await gc.enter();
      } catch (e) {
        isJoiningRef.current = false;
        if (isPermissionLikeGroupCallError(e)) {
          setErrorCode('PERMISSION_DENIED');
        } else {
          setErrorCode('WEBRTC_FAILED');
        }
        setCallState('error');
        runCleanup();
        setCallKind(null);
        setThreadContext(null);
        return;
      }

      setCallState('connected');
      refreshLocalPreview();
      updateParticipantCount();
      setIsMicrophoneMuted(gc.isMicrophoneMuted());
      setIsLocalVideoMuted(gc.isLocalVideoMuted());
      isJoiningRef.current = false;
    },
    [
      attachGroupCallListeners,
      client,
      roomId,
      refreshLocalPreview,
      runCleanup,
      updateParticipantCount,
    ],
  );

  const enterAudio = useCallback(
    async (threadRootEventId?: string) => {
      await enterWithKind('audio', threadRootEventId);
    },
    [enterWithKind],
  );

  const enterVideo = useCallback(
    async (threadRootEventId?: string) => {
      await enterWithKind('video', threadRootEventId);
    },
    [enterWithKind],
  );

  const leave = useCallback(async () => {
    if (callState === 'idle' || callState === 'disconnecting') return;
    setCallState('disconnecting');
    runCleanup();
    setCallState('idle');
    setErrorCode(null);
    setCallKind(null);
    setIsScreensharing(false);
    setThreadContext(null);
    setParticipantCount(0);
  }, [callState, runCleanup]);

  const setMicrophoneMuted = useCallback(async (muted: boolean) => {
    const gc = groupCallRef.current;
    if (!gc) return;
    await gc.setMicrophoneMuted(muted);
    setIsMicrophoneMuted(gc.isMicrophoneMuted());
  }, []);

  const setCameraMuted = useCallback(async (muted: boolean) => {
    const gc = groupCallRef.current;
    if (!gc) return;
    await gc.setLocalVideoMuted(muted);
    setIsLocalVideoMuted(gc.isLocalVideoMuted());
  }, []);

  const setScreensharingEnabled = useCallback(async (enabled: boolean) => {
    const gc = groupCallRef.current;
    if (!gc) return;
    await gc.setScreensharingEnabled(enabled);
  }, []);

  useEffect(() => {
    if (!roomId && groupCallRef.current) {
      setCallState('disconnecting');
      runCleanup();
      setCallState('idle');
      setErrorCode(null);
      setCallKind(null);
      setIsScreensharing(false);
      setThreadContext(null);
      setParticipantCount(0);
    }
  }, [roomId, runCleanup]);

  useEffect(() => {
    return () => {
      runCleanup();
    };
  }, [runCleanup]);

  return {
    callState,
    errorCode,
    threadContext,
    callKind,
    enterAudio,
    enterVideo,
    leave,
    setMicrophoneMuted,
    setCameraMuted,
    setScreensharingEnabled,
    isScreensharing,
    localPreviewStream,
    participantSummary: { count: participantCount },
    isMicrophoneMuted,
    isLocalVideoMuted,
  };
}
