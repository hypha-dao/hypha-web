'use client';

import { Phone, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallState } from '@hypha-platform/core/client';

type HumanChatPanelCallToolbarProps = {
  callState: SpaceGroupCallState;
  callKind: 'audio' | 'video' | null;
  disabled: boolean;
  inCall: boolean;
  /** True when other members have devices in the room GroupCall and local user is not in the session. */
  roomCallInProgressToJoin?: boolean;
  /**
   * True when a GroupCall session exists in the room but the local user is idle
   * and the only current participant is the starter (1 device) — use “Start”
   * copy; otherwise “Join” when more devices.
   */
  onlyLocalInRoomCall?: boolean;
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
  inCall,
  roomCallInProgressToJoin = false,
  onlyLocalInRoomCall = false,
  onAudio,
  onVideo,
}: HumanChatPanelCallToolbarProps) {
  const t = useTranslations('HumanChatPanel');

  const busy =
    callState === 'initializing' ||
    callState === 'awaiting_media' ||
    callState === 'connecting' ||
    callState === 'disconnecting';
  const inVideoMode = inCall && callKind === 'video';

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
          'flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors',
          (disabled || busy) && 'cursor-not-allowed opacity-50',
          !disabled && !busy && 'hover:bg-muted hover:text-foreground',
          inCall && !inVideoMode && 'text-foreground',
        )}
        title={
          roomCallInProgressToJoin
            ? onlyLocalInRoomCall
              ? t('callStartWithAudio')
              : t('callJoinWithAudio')
            : t('callAudio')
        }
        aria-label={
          roomCallInProgressToJoin
            ? onlyLocalInRoomCall
              ? t('callStartWithAudio')
              : t('callJoinWithAudio')
            : t('callAudio')
        }
        aria-pressed={inCall && !inVideoMode}
        aria-busy={busy}
      >
        <Phone className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onVideo}
        disabled={disabled || busy}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors',
          (disabled || busy) && 'cursor-not-allowed opacity-50',
          !disabled && !busy && 'hover:bg-muted hover:text-foreground',
          inCall && inVideoMode && 'text-foreground',
        )}
        title={
          roomCallInProgressToJoin
            ? onlyLocalInRoomCall
              ? t('callStartWithVideo')
              : t('callJoinWithVideo')
            : t('callVideo')
        }
        aria-label={
          roomCallInProgressToJoin
            ? onlyLocalInRoomCall
              ? t('callStartWithVideo')
              : t('callJoinWithVideo')
            : t('callVideo')
        }
        aria-pressed={inCall && inVideoMode}
        aria-busy={busy}
      >
        <Video className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
