'use client';

import { Phone, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallState } from '@hypha-platform/core/client';
import {
  callToolbarButtonMessageKeys,
  type CallToolbarLabelScope,
} from './call-toolbar-labels';

type HumanChatPanelCallToolbarProps = {
  callState: SpaceGroupCallState;
  callKind: 'audio' | 'video' | null;
  disabled: boolean;
  /** True when the room GroupCall has participants and local user is not in the session. */
  roomCallInProgressToJoin?: boolean;
  /**
   * Signal threads name the call as a signal. Space, DM, and group chats keep
   * the shared room labels.
   */
  labelScope?: CallToolbarLabelScope;
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
  labelScope = 'room',
  onAudio,
  onVideo,
}: HumanChatPanelCallToolbarProps) {
  const t = useTranslations('HumanChatPanel');
  const labels = callToolbarButtonMessageKeys(
    labelScope,
    roomCallInProgressToJoin,
  );

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

  const activeCallChip = 'text-accent-11';

  /** Dim the non-primary control while the call is still connecting, but keep the mode you chose legible. */
  const phoneDim = (disabled || busy) && !audioIsActive;
  const videoDim = (disabled || busy) && !videoIsActive;

  // Identical hit targets; Phone’s diagonal glyph reads larger than Video at
  // the same SVG size, so scale it slightly for optical parity.
  const iconBtn =
    'box-border inline-grid h-[36px] w-[36px] flex-none shrink-0 place-items-center rounded-none bg-transparent p-0 leading-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground [&>svg]:block';
  const iconSize = 'craft-icon';

  return (
    <div className="contents" role="toolbar" aria-label={t('callToolbarLabel')}>
      <button
        type="button"
        onClick={onAudio}
        disabled={disabled || busy}
        className={cn(
          iconBtn,
          phoneDim && 'cursor-not-allowed opacity-50',
          !audioIsActive && 'text-muted-foreground',
          audioIsActive && activeCallChip,
        )}
        title={t(labels.audio)}
        aria-label={t(labels.audio)}
        aria-pressed={audioIsActive}
        aria-busy={busy}
      >
        <Phone
          className={cn(iconSize, 'scale-[0.88]')}
          strokeWidth={1.25}
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
          !videoIsActive && 'text-muted-foreground',
          videoIsActive && activeCallChip,
        )}
        title={t(labels.video)}
        aria-label={t(labels.video)}
        aria-pressed={videoIsActive}
        aria-busy={busy}
      >
        <Video className={iconSize} strokeWidth={1.25} aria-hidden />
      </button>
    </div>
  );
}
