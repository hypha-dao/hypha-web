'use client';

import {
  Loader2,
  LogOut,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type {
  SpaceGroupCallErrorCode,
  SpaceGroupCallState,
} from '@hypha-platform/core/client';

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
  participantCount: number;
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
    (errorCode === 'PERMISSION_DENIED' ||
      errorCode === 'WEBRTC_FAILED' ||
      errorCode === 'UNKNOWN');

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
            {t('callActiveInSpace')}{' '}
            {participantCount > 0
              ? t('callParticipantCount', { count: participantCount })
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
        <div
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label={t('callToolbarLabel')}
        >
          <button
            type="button"
            onClick={onToggleMic}
            disabled={controlsDisabled}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
              isMicrophoneMuted
                ? 'bg-destructive/15 text-destructive'
                : 'bg-background text-foreground',
              controlsDisabled && 'opacity-50',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
            aria-pressed={isMicrophoneMuted}
            aria-label={isMicrophoneMuted ? t('callUnmute') : t('callMute')}
          >
            {isMicrophoneMuted ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </button>
          {callKind === 'video' && (
            <button
              type="button"
              onClick={onToggleCamera}
              disabled={controlsDisabled}
              className={cn(
                'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
                isLocalVideoMuted
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-background text-foreground',
                controlsDisabled && 'opacity-50',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
              aria-pressed={isLocalVideoMuted}
              aria-label={
                isLocalVideoMuted ? t('callCameraOn') : t('callCameraOff')
              }
            >
              {isLocalVideoMuted ? (
                <VideoOff className="h-3.5 w-3.5" />
              ) : (
                <Video className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleScreenshare}
            disabled={controlsDisabled}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
              isScreensharing
                ? 'bg-accent-9/20 text-foreground ring-1 ring-inset ring-accent-9/35'
                : 'bg-background text-foreground',
              controlsDisabled && 'opacity-50',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
            aria-pressed={isScreensharing}
            aria-label={
              isScreensharing
                ? t('callScreenshareStop')
                : t('callScreenshareStart')
            }
          >
            {isScreensharing ? (
              <MonitorOff className="h-3.5 w-3.5" />
            ) : (
              <Monitor className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onLeave}
            disabled={callState === 'disconnecting'}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={t('callLeave')}
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('callLeave')}
          </button>
        </div>
      </div>
    </div>
  );
}
