import type * as MatrixSdk from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type {
  SpaceGroupCallCaptureMode,
  SpaceGroupCallRecordingStatus,
} from './space-group-call-state';

export const CALL_CAPTURE_NOTICE_TYPE = 'io.hypha.call_capture_notice.v1';

export type SpaceGroupCallCaptureConsent = {
  actor: string;
  mode: Exclude<SpaceGroupCallCaptureMode, 'none'>;
  isLocalInitiator: boolean;
  paused?: boolean;
};

type CaptureNoticeContent = {
  [CALL_CAPTURE_NOTICE_TYPE]?: boolean;
  action?: 'started' | 'stopped';
  mode?: SpaceGroupCallCaptureMode;
};

export function isCallCaptureNoticeEvent(
  event: MatrixSdk.MatrixEvent,
): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  const content = event.getContent() as CaptureNoticeContent;
  return content[CALL_CAPTURE_NOTICE_TYPE] === true;
}

/** Newest capture notice in `eventsNewestFirst` wins (started → active, stopped → inactive). */
export function resolveActiveRoomCaptureFromEvents(
  eventsNewestFirst: MatrixSdk.MatrixEvent[],
  resolveActor: (senderId: string) => string,
  localUserId: string | null,
): SpaceGroupCallCaptureConsent | null {
  for (const event of eventsNewestFirst) {
    if (!isCallCaptureNoticeEvent(event)) continue;
    const content = event.getContent() as CaptureNoticeContent;
    if (content.action === 'stopped') return null;
    if (content.action !== 'started') continue;
    if (
      content.mode !== 'recording_with_transcript' &&
      content.mode !== 'transcript_only'
    ) {
      continue;
    }
    const sender = event.getSender() ?? '';
    return {
      actor: resolveActor(sender) || sender || 'A participant',
      mode: content.mode,
      isLocalInitiator: Boolean(localUserId && sender === localUserId),
    };
  }
  return null;
}

export function resolveLocalCaptureConsent(params: {
  captureMode: SpaceGroupCallCaptureMode;
  recordingStatus: SpaceGroupCallRecordingStatus;
}): SpaceGroupCallCaptureConsent | null {
  const { captureMode, recordingStatus } = params;
  if (captureMode === 'none') return null;
  if (
    recordingStatus !== 'recording' &&
    recordingStatus !== 'paused' &&
    recordingStatus !== 'uploading'
  ) {
    return null;
  }
  return {
    actor: '',
    mode: captureMode,
    isLocalInitiator: true,
    paused: recordingStatus === 'paused',
  };
}

export function resolveCaptureConsent(
  roomCapture: SpaceGroupCallCaptureConsent | null,
  localCapture: SpaceGroupCallCaptureConsent | null,
): SpaceGroupCallCaptureConsent | null {
  return localCapture ?? roomCapture;
}
