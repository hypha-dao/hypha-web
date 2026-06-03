'use client';

import { Phone, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallState } from '@hypha-platform/core/client';

type HumanChatPanelCallToolbarProps = {
  callState: SpaceGroupCallState;
  callKind: 'audio' | 'video' | null;
  disabled: boolean;
  /** True when the room GroupCall has participants and local user is not in the session. */
  roomCallInProgressToJoin?: boolean;
  onAudio: () => void;
  onVideo: () => void;
};

/**
 * Space voice/video entry (phone, video) for the human chat tab row end cluster.
 * In-chat search is hidden for now to give the tab menu more horizontal space.
 * Spec: voice-video-call-implementation-spec §3.1–3.2
 */
export function HumanChatPanelCallToolbar({
  callState,
  callKind,
  disabled,
  roomCallInProgressToJoin = false,
  onAudio,
  onVideo,
}: HumanChatPanelCallToolbarProps) {
  const t = useTranslations('HumanChatPanel');

  const busy =
    callState === 'initializing' ||
    callState === 'awaiting_media' ||
    callState === 'connecting' ||
    callState === 'disconnecting';

  /** In our session: highlight the control that matches `callKind` (not only at `connected`). */
  const sessionActive =
    callState === 'initializing' ||
    callState === 'awaiting_media' ||
    callState === 'connecting' ||
    callState === 'connected' ||
    callState === 'disconnecting';
  const audioIsActive = sessionActive && callKind === 'audio';
  const videoIsActive = sessionActive && callKind === 'video';

  const activeCallChip =
    'border border-accent-9/45 bg-accent-9/20 text-foreground shadow-sm ring-1 ring-inset ring-accent-9/25 dark:border-accent-10/50 dark:bg-accent-9/28 dark:ring-accent-10/30';

  /** Dim the non-primary control while the call is still connecting, but keep the mode you chose legible. */
  const phoneDim = (disabled || busy) && !audioIsActive;
  const videoDim = (disabled || busy) && !videoIsActive;

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-0.5"
      role="toolbar"
      aria-label={t('callToolbarLabel')}
    >
      <button
        type="button"
        onClick={onAudio}
        disabled={disabled || busy}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
          phoneDim && 'cursor-not-allowed opacity-50',
          !disabled && !busy && 'hover:bg-muted hover:text-foreground',
          !audioIsActive && 'text-muted-foreground',
          audioIsActive && activeCallChip,
        )}
        title={
          roomCallInProgressToJoin ? t('callJoinWithAudio') : t('callAudio')
        }
        aria-label={
          roomCallInProgressToJoin ? t('callJoinWithAudio') : t('callAudio')
        }
        aria-pressed={audioIsActive}
        aria-busy={busy}
      >
        <Phone
          className={cn('h-3.5 w-3.5', audioIsActive && 'stroke-2')}
          aria-hidden
        />
      </button>
      <button
        type="button"
        onClick={onVideo}
        disabled={disabled || busy}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
          videoDim && 'cursor-not-allowed opacity-50',
          !disabled && !busy && 'hover:bg-muted hover:text-foreground',
          !videoIsActive && 'text-muted-foreground',
          videoIsActive && activeCallChip,
        )}
        title={
          roomCallInProgressToJoin ? t('callJoinWithVideo') : t('callVideo')
        }
        aria-label={
          roomCallInProgressToJoin ? t('callJoinWithVideo') : t('callVideo')
        }
        aria-pressed={videoIsActive}
        aria-busy={busy}
      >
        <Video
          className={cn('h-3.5 w-3.5', videoIsActive && 'stroke-2')}
          aria-hidden
        />
      </button>
    </div>
  );
}
