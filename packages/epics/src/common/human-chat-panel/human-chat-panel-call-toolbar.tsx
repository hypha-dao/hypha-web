'use client';

import { Phone, Search, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallState } from '@hypha-platform/core/client';

type HumanChatPanelCallToolbarProps = {
  callState: SpaceGroupCallState;
  disabled: boolean;
  inCall: boolean;
  onAudio: () => void;
  onVideo: () => void;
  onSearch: () => void;
};

/**
 * Space voice/video entry icons (phone, video, search) for the human chat header row.
 * Spec: voice-video-call-implementation-spec §3.1–3.2
 */
export function HumanChatPanelCallToolbar({
  callState,
  disabled,
  inCall,
  onAudio,
  onVideo,
  onSearch,
}: HumanChatPanelCallToolbarProps) {
  const t = useTranslations('HumanChatPanel');

  const busy =
    callState === 'initializing' ||
    callState === 'awaiting_media' ||
    callState === 'connecting';

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
          inCall && 'text-foreground',
        )}
        title={t('callAudio')}
        aria-label={t('callAudio')}
        aria-pressed={inCall}
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
        )}
        title={t('callVideo')}
        aria-label={t('callVideo')}
        aria-busy={busy}
      >
        <Video className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onSearch}
        disabled
        className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-lg text-muted-foreground/60 opacity-60"
        title={t('callSearchComingSoon')}
        aria-label={t('callSearch')}
        aria-disabled
      >
        <Search className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
