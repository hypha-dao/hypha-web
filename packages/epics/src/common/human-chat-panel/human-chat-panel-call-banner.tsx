'use client';

import { Loader2, LogOut, Mic, MicOff, Video, VideoOff } from 'lucide-react';
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
  isMicrophoneMuted: boolean;
  isLocalVideoMuted: boolean;
  participantCount: number;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
};

function errorKey(code: SpaceGroupCallErrorCode): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'callErrorPermission';
    case 'NOT_READY':
    case 'NO_ROOM':
    case 'NO_CLIENT':
      return 'callErrorGeneric';
    default:
      return 'callErrorGeneric';
  }
}

/**
 * In-call strip: space-wide label, connection state, mute, camera, leave.
 */
export function HumanChatPanelCallBanner({
  callState,
  callKind,
  errorCode,
  isMicrophoneMuted,
  isLocalVideoMuted,
  participantCount,
  onLeave,
  onToggleMic,
  onToggleCamera,
}: HumanChatPanelCallBannerProps) {
  const t = useTranslations('HumanChatPanel');

  if (callState === 'error' && errorCode) {
    return (
      <div
        role="alert"
        className="border-b border-border bg-destructive/10 px-4 py-2.5"
      >
        <p className="text-sm text-destructive">{t(errorKey(errorCode))}</p>
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
    <div className="flex min-h-[44px] flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
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
          <p className="text-xs text-muted-foreground">{t('callConnecting')}</p>
        )}
      </div>
      {isConnectingPhase && (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
      )}
      <div className="flex shrink-0 items-center gap-1">
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
          onClick={onLeave}
          disabled={callState === 'disconnecting'}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/20"
          aria-label={t('callLeave')}
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('callLeave')}
        </button>
      </div>
    </div>
  );
}
