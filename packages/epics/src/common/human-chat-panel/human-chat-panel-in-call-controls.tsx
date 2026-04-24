'use client';

import {
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallState } from '@hypha-platform/core/client';

type HumanChatPanelInCallControlsProps = {
  callState: SpaceGroupCallState;
  callKind: 'audio' | 'video' | null;
  isMicrophoneMuted: boolean;
  isLocalVideoMuted: boolean;
  isScreensharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenshare: () => void;
  onLeave: () => void;
  /** In header strip: compact buttons; in full view: larger, high-contrast on video. */
  variant?: 'inBanner' | 'fullView';
};

/**
 * Mute, camera, screen share, and leave — shared by {@link HumanChatPanelCallBanner}
 * and the full-view dialog (§3.4.4).
 */
export function HumanChatPanelInCallControls({
  callState,
  callKind,
  isMicrophoneMuted,
  isLocalVideoMuted,
  isScreensharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenshare,
  onLeave,
  variant = 'inBanner',
}: HumanChatPanelInCallControlsProps) {
  const t = useTranslations('HumanChatPanel');
  const isConnectingPhase =
    callState === 'connecting' ||
    callState === 'awaiting_media' ||
    callState === 'initializing';
  const isDisconnecting = callState === 'disconnecting';
  const controlsDisabled = isConnectingPhase || isDisconnecting;
  const isFull = variant === 'fullView';

  const baseBtn = isFull
    ? 'h-10 min-w-10 sm:h-11 sm:min-w-11 rounded-full border border-border/50 bg-zinc-900/85 px-2.5 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-800/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring'
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const neutralBtn = isFull ? baseBtn : 'bg-background text-foreground';
  const leaveIcon = isFull ? 'h-5 w-5' : 'h-4 w-4';
  /** End call — circular like mic/cam/share; high-contrast red without “pill + caption” weight. */
  const leaveBtn = isFull
    ? 'inline-flex h-10 min-w-10 sm:h-11 sm:min-w-11 items-center justify-center rounded-full border border-destructive/50 bg-destructive text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring'
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/45 bg-destructive text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const micMutedBtn = isFull
    ? cn(
        baseBtn,
        'bg-destructive/25 text-destructive border-destructive/35 hover:bg-destructive/35',
      )
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20';
  const shareActiveBtn = isFull
    ? cn(baseBtn, 'ring-2 ring-accent-9/50 bg-accent-9/20 border-accent-9/30')
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-accent-9/18 text-foreground ring-1 ring-inset ring-accent-9/35';
  const camOffBtn = isFull
    ? cn(baseBtn, 'bg-destructive/25 text-destructive border-destructive/35')
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20';
  const icon = isFull ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div
      className="flex w-full items-center justify-center gap-1.5 sm:gap-2"
      role="group"
      aria-label={t('callToolbarLabel')}
    >
      <button
        type="button"
        onClick={onToggleMic}
        disabled={controlsDisabled}
        className={cn(
          isFull
            ? isMicrophoneMuted
              ? micMutedBtn
              : baseBtn
            : isMicrophoneMuted
            ? micMutedBtn
            : neutralBtn,
          (isFull || isMicrophoneMuted) &&
            'inline-flex items-center justify-center',
          'disabled:cursor-not-allowed',
          !isFull && controlsDisabled && 'opacity-50',
        )}
        aria-pressed={isMicrophoneMuted}
        aria-label={isMicrophoneMuted ? t('callUnmute') : t('callMute')}
      >
        {isMicrophoneMuted ? (
          <MicOff className={icon} />
        ) : (
          <Mic className={icon} />
        )}
      </button>
      {callKind === 'video' && (
        <button
          type="button"
          onClick={onToggleCamera}
          disabled={controlsDisabled}
          className={cn(
            isFull
              ? isLocalVideoMuted
                ? camOffBtn
                : baseBtn
              : isLocalVideoMuted
              ? camOffBtn
              : neutralBtn,
            (isFull || isLocalVideoMuted) &&
              'inline-flex items-center justify-center',
            'disabled:cursor-not-allowed',
            !isFull && controlsDisabled && 'opacity-50',
          )}
          aria-pressed={isLocalVideoMuted}
          aria-label={
            isLocalVideoMuted ? t('callCameraOn') : t('callCameraOff')
          }
        >
          {isLocalVideoMuted ? (
            <VideoOff className={icon} />
          ) : (
            <Video className={icon} />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onToggleScreenshare}
        disabled={controlsDisabled}
        className={cn(
          isFull
            ? isScreensharing
              ? shareActiveBtn
              : baseBtn
            : isScreensharing
            ? shareActiveBtn
            : neutralBtn,
          (isFull || isScreensharing) &&
            'inline-flex items-center justify-center',
          'disabled:cursor-not-allowed',
          !isFull && controlsDisabled && 'opacity-50',
        )}
        aria-pressed={isScreensharing}
        aria-label={
          isScreensharing ? t('callScreenshareStop') : t('callScreenshareStart')
        }
      >
        {isScreensharing ? (
          <MonitorOff className={icon} />
        ) : (
          <Monitor className={icon} />
        )}
      </button>
      <button
        type="button"
        onClick={onLeave}
        disabled={callState === 'disconnecting'}
        className={cn(
          leaveBtn,
          'disabled:cursor-not-allowed',
          !isFull && callState === 'disconnecting' && 'opacity-50',
        )}
        title={t('callLeave')}
        aria-label={t('callLeave')}
      >
        <PhoneOff className={leaveIcon} strokeWidth={2.25} />
      </button>
    </div>
  );
}
