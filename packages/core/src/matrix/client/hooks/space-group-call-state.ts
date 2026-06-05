/**
 * Shared call UI state machine (Matrix `useSpaceGroupCall` + in-call controls).
 * Keep in a standalone module (no React) so `space-group-call-utils` and UI
 * can share `SpaceGroupCallState` without import cycles.
 * @public
 */
export type SpaceGroupCallState =
  | 'idle'
  | 'initializing'
  | 'awaiting_media'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type SpaceGroupCallRecordingStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'uploading'
  | 'error';

export type SpaceGroupCallCaptureMode =
  | 'none'
  | 'transcript_only'
  | 'recording_with_transcript';

export function getCallControlsPhase(state: SpaceGroupCallState): {
  isConnectingPhase: boolean;
  isDisconnecting: boolean;
  controlsDisabled: boolean;
} {
  const isConnectingPhase =
    state === 'connecting' ||
    state === 'awaiting_media' ||
    state === 'initializing';
  const isDisconnecting = state === 'disconnecting';
  return {
    isConnectingPhase,
    isDisconnecting,
    controlsDisabled: isConnectingPhase || isDisconnecting,
  };
}
