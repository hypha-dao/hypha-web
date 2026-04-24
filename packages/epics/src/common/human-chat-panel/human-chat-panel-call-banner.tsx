'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  SpaceGroupCallErrorCode,
  SpaceGroupCallState,
} from '@hypha-platform/core/client';
import { HumanChatPanelInCallControls } from './human-chat-panel-in-call-controls';

type HumanChatPanelCallBannerProps = {
  callState: SpaceGroupCallState;
  callKind: 'audio' | 'video' | null;
  errorCode: SpaceGroupCallErrorCode | null;
  /** Local screen share; Phase 4 Share / Stop control. */
  isScreensharing: boolean;
  /** Non-fatal display-capture error; does not end the call. */
  screenshareErrorCode: SpaceGroupCallErrorCode | null;
  /** True when document is hidden during an active call (Phase 5.1). */
  tabBackgroundWhileInCall: boolean;
  isMicrophoneMuted: boolean;
  isLocalVideoMuted: boolean;
  /** Active devices in the room GroupCall (from Matrix). */
  participantCount: number;
  /** When >=1, show that others are in the call (not the local user—used for "Y others"). */
  othersInRoomCallCount: number;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenshare: () => void;
  onDismissScreenshareError: () => void;
  /** Reconnect after a recoverable call error. */
  onRetryCall: () => void;
  onDismissCallError: () => void;
};

function errorKey(code: SpaceGroupCallErrorCode): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'callErrorPermission';
    case 'NOT_READY':
      return 'callErrorNotReady';
    case 'NO_ROOM':
      return 'callErrorNoRoom';
    case 'NO_CLIENT':
      return 'callErrorNoClient';
    default:
      return 'callErrorGeneric';
  }
}

function screenshareErrorKey(code: SpaceGroupCallErrorCode): string {
  return code === 'PERMISSION_DENIED'
    ? 'callErrorPermission'
    : 'callErrorScreenshare';
}

/**
 * In-call strip: space-wide label, connection state, mute, camera, leave.
 */
export function HumanChatPanelCallBanner({
  callState,
  callKind,
  errorCode,
  isScreensharing,
  screenshareErrorCode,
  isMicrophoneMuted,
  isLocalVideoMuted,
  participantCount,
  othersInRoomCallCount,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onToggleScreenshare,
  onDismissScreenshareError,
  tabBackgroundWhileInCall,
  onRetryCall,
  onDismissCallError,
}: HumanChatPanelCallBannerProps) {
  const t = useTranslations('HumanChatPanel');
  const showRetryOnError =
    errorCode != null &&
    (errorCode === 'WEBRTC_FAILED' || errorCode === 'UNKNOWN');

  if (callState === 'error' && errorCode) {
    return (
      <div
        role="alert"
        className="border-b border-border bg-destructive/10 px-4 py-2.5"
        aria-live="assertive"
      >
        <p className="text-sm text-destructive">{t(errorKey(errorCode))}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {showRetryOnError ? (
            <button
              type="button"
              onClick={onRetryCall}
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t('callErrorRetry')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismissCallError}
            className="inline-flex h-8 items-center rounded-md border border-transparent bg-transparent px-2.5 text-xs font-medium text-destructive underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t('callErrorDismiss')}
          </button>
        </div>
      </div>
    );
  }

  if (
    callState !== 'connecting' &&
    callState !== 'connected' &&
    callState !== 'awaiting_media' &&
    callState !== 'initializing' &&
    callState !== 'disconnecting'
  ) {
    return null;
  }

  const isConnectingPhase =
    callState === 'connecting' ||
    callState === 'awaiting_media' ||
    callState === 'initializing';
  const isDisconnecting = callState === 'disconnecting';
  const controlsDisabled = isConnectingPhase || isDisconnecting;

  return (
    <div className="border-b border-border bg-muted/30">
      <div
        role="status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {isConnectingPhase
          ? t('callConnecting')
          : callState === 'connected'
          ? t('callActiveInSpace')
          : null}
      </div>
      {callState === 'connected' && tabBackgroundWhileInCall && (
        <p className="border-b border-border/60 bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
          {t('callTabBackgroundHint')}
        </p>
      )}
      {screenshareErrorCode && callState === 'connected' && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-border/60 bg-destructive/10 px-4 py-1.5"
        >
          <p className="min-w-0 flex-1 text-xs text-destructive">
            {t(screenshareErrorKey(screenshareErrorCode))}
          </p>
          <button
            type="button"
            onClick={onDismissScreenshareError}
            className="shrink-0 text-xs font-medium text-destructive underline-offset-2 hover:underline"
          >
            {t('callScreenshareDismiss')}
          </button>
        </div>
      )}
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            {callState === 'connected'
              ? t('callYouAreInSpaceCall')
              : t('callActiveInSpace')}{' '}
            {participantCount > 0
              ? t('callDeviceCountInRoom', { count: participantCount })
              : null}
            {callState === 'connected' && othersInRoomCallCount > 0
              ? t('callOthersInCallHint', { count: othersInRoomCallCount })
              : null}
          </p>
          {isDisconnecting && (
            <p className="text-xs text-muted-foreground">
              {t('callDisconnecting')}
            </p>
          )}
          {isConnectingPhase && (
            <p className="text-xs text-muted-foreground">
              {t('callConnecting')}
            </p>
          )}
        </div>
        {isConnectingPhase && (
          <Loader2
            className="h-4 w-4 shrink-0 motion-reduce:animate-none animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
        <div className="shrink-0">
          <HumanChatPanelInCallControls
            callState={callState}
            callKind={callKind}
            isMicrophoneMuted={isMicrophoneMuted}
            isLocalVideoMuted={isLocalVideoMuted}
            isScreensharing={isScreensharing}
            onToggleMic={onToggleMic}
            onToggleCamera={onToggleCamera}
            onToggleScreenshare={onToggleScreenshare}
            onLeave={onLeave}
            variant="inBanner"
          />
        </div>
      </div>
    </div>
  );
}
