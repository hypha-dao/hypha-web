'use client';

import {
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { CallHangUpIcon } from './call-hang-up-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import {
  getCallControlsPhase,
  type SpaceGroupCallState,
} from '@hypha-platform/core/client';

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
  const { controlsDisabled } = getCallControlsPhase(callState);
  const isFull = variant === 'fullView';
  /**
   * Full view modal: §3.4.4.4 — white glyphs on dark / green / red (not
   * `text-foreground` on near-black / green where Lucide would read as black).
   */
  const fullViewIcon = 'h-5 w-5 text-white stroke-white';
  const baseBtn = isFull
    ? 'h-10 min-w-10 sm:h-11 sm:min-w-11 inline-flex items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/90 px-2.5 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-800/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const neutralBtn = isFull ? baseBtn : 'bg-background text-foreground';
  const leaveIcon = isFull ? fullViewIcon : 'h-4 w-4';
  /**
   * End call — classic “hang up” red (explicit red-600/700, not `destructive` token
   * which can read as salmon in dark UIs on video chrome).
   */
  const leaveBtn = isFull
    ? 'inline-flex h-10 min-w-10 sm:h-11 sm:min-w-11 items-center justify-center rounded-full border border-red-800/25 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/50 disabled:opacity-50'
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-800/30 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/40';
  const micMutedBtn = isFull
    ? cn(baseBtn, 'border-rose-500/50 bg-rose-900/50 hover:bg-rose-900/70')
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20';
  const shareActiveBtn = isFull
    ? cn(
        baseBtn,
        'ring-2 ring-white/25 border-emerald-500/60 bg-emerald-600/90 hover:bg-emerald-500/90',
      )
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/55 bg-emerald-600/90 text-white shadow-sm ring-2 ring-emerald-500/25 transition-colors hover:bg-emerald-500/90';
  const camOffBtn = isFull
    ? cn(baseBtn, 'border-rose-500/50 bg-rose-900/50 hover:bg-rose-900/70')
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20';
  const icon = isFull ? fullViewIcon : 'h-4 w-4';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 sm:gap-2',
        isFull ? 'w-full justify-center' : 'w-auto justify-start',
      )}
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
        title={t('callControlsMicrophone')}
        aria-label={
          isMicrophoneMuted
            ? t('callControlsMicrophoneMutedAria')
            : t('callControlsMicrophoneUnmutedAria')
        }
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
          title={t('callControlsCamera')}
          aria-label={
            isLocalVideoMuted
              ? t('callControlsCameraOffAria')
              : t('callControlsCameraOnAria')
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
        title={t('callControlsScreenshare')}
        aria-label={
          isScreensharing
            ? t('callControlsScreenshareActiveAria')
            : t('callControlsScreenshareInactiveAria')
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
          callState === 'disconnecting' && 'opacity-50',
        )}
        title={t('callLeave')}
        aria-label={t('callLeave')}
      >
        <CallHangUpIcon className={leaveIcon} />
      </button>
    </div>
  );
}
