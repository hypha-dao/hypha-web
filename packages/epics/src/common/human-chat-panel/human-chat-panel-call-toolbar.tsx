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

  const iconBtn =
    'box-border flex h-[28px] w-[28px] min-h-[28px] min-w-[28px] max-h-[28px] max-w-[28px] flex-none items-center justify-center rounded-lg p-0 transition-colors';
  const iconSize = 'h-4 w-4 shrink-0';

  return (
    <div
      className="relative z-10 flex shrink-0 items-center gap-1"
      role="toolbar"
      aria-label={t('callToolbarLabel')}
    >
      <button
        type="button"
        onClick={onAudio}
        disabled={disabled || busy}
        className={cn(
          iconBtn,
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
          className={iconSize}
          strokeWidth={audioIsActive ? 2.25 : 2}
          aria-hidden
        />
      </button>
      <button
        type="button"
        onClick={onVideo}
        disabled={disabled || busy}
        className={cn(
          iconBtn,
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
          className={iconSize}
          strokeWidth={videoIsActive ? 2.25 : 2}
          aria-hidden
        />
      </button>
    </div>
  );
}
