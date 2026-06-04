import { cn } from '@hypha-platform/ui-utils';

/** WCUX-LAYOUT-5 — participant label bar minimum height on video tiles. */
export const CALL_FEED_VIDEO_LABEL_MIN_HEIGHT_CLASS = 'min-h-[1.75rem]';

export type CallFeedAudioScrimLayout = {
  panelDockTile: boolean;
  scrimClass: string;
  contentClass: string;
  avatarClass: string;
  avatarIconClass: string;
  nameClass: string;
  waveSize: 'sm' | 'md' | 'lg';
  waveClass: string;
  mutedClass: string;
};

/**
 * Audio-only / camera-off scrim: avatar, name, and voice waves stay centered in the tile.
 * Panel dock strips use compact sizing so content fits inside 16:9 cells.
 */
export function resolveCallFeedAudioScrimLayout(input: {
  isPip: boolean;
  isFullView: boolean;
  isDocumentPipOpen: boolean;
}): CallFeedAudioScrimLayout {
  const panelDockTile =
    !input.isFullView && !input.isPip && !input.isDocumentPipOpen;

  const scrimClass = cn(
    'relative z-[2] flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden text-center',
    'bg-gradient-to-b from-zinc-900/95 to-black text-zinc-50',
    input.isPip
      ? 'gap-1.5 p-2'
      : input.isFullView
      ? 'gap-3 p-4'
      : 'gap-1.5 p-2',
  );

  const contentClass =
    'flex min-h-0 w-full max-w-full flex-col items-center justify-center';

  const avatarClass = cn(
    'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-zinc-200 ring-1 ring-white/20',
    input.isPip
      ? 'h-8 w-8'
      : input.isFullView
      ? 'h-20 w-20 sm:h-24 sm:w-24'
      : panelDockTile
      ? 'h-10 w-10'
      : 'h-14 w-14',
  );

  const avatarIconClass = cn(
    input.isPip
      ? 'h-4 w-4'
      : input.isFullView
      ? 'h-10 w-10 sm:h-12 sm:w-12'
      : panelDockTile
      ? 'h-5 w-5'
      : 'h-7 w-7',
  );

  const nameClass = cn(
    'max-w-full shrink-0 font-medium text-zinc-50',
    input.isPip
      ? 'line-clamp-2 text-[10px] leading-tight'
      : input.isFullView
      ? 'line-clamp-2 text-base sm:text-lg'
      : panelDockTile
      ? 'line-clamp-1 text-xs leading-snug'
      : 'line-clamp-2 text-sm',
  );

  const waveSize: CallFeedAudioScrimLayout['waveSize'] = input.isPip
    ? 'sm'
    : input.isFullView
    ? 'lg'
    : panelDockTile
    ? 'sm'
    : 'md';

  const waveClass = cn(
    'mx-auto shrink-0',
    input.isPip
      ? 'max-w-[5.5rem]'
      : input.isFullView
      ? 'w-full max-w-[min(24rem,96%)]'
      : panelDockTile
      ? 'max-w-[min(10rem,92%)]'
      : 'max-w-[min(16rem,90%)]',
  );

  const mutedClass = cn(
    'inline-flex shrink-0 items-center justify-center gap-1 font-medium text-destructive',
    input.isPip ? 'text-[9px]' : 'text-xs',
  );

  return {
    panelDockTile,
    scrimClass,
    contentClass,
    avatarClass,
    avatarIconClass,
    nameClass,
    waveSize,
    waveClass,
    mutedClass,
  };
}

export type CallFeedVideoParticipantLabelLayout = {
  barClass: string;
  /** Hide mute word on narrow tiles — icon stays visible; label remains for SR. */
  muteTextSrOnly: boolean;
};

/**
 * Zoom-style floating label on live video tiles (bottom-start chip, not full-width bar).
 */
export function resolveCallFeedVideoParticipantLabelLayout(input: {
  isFullView: boolean;
  compactTileLayout: boolean;
}): CallFeedVideoParticipantLabelLayout {
  const compactChrome = input.compactTileLayout;

  return {
    barClass: cn(
      'absolute z-10 flex w-max max-w-[calc(100%-0.75rem)] items-center gap-1 bg-black/75 shadow-sm backdrop-blur-[2px]',
      CALL_FEED_VIDEO_LABEL_MIN_HEIGHT_CLASS,
      compactChrome
        ? 'start-1 bottom-1 rounded-md px-1.5 py-0.5 text-[10px] leading-4'
        : input.isFullView
        ? 'start-2 bottom-2 rounded-md px-2 py-0.5 text-xs leading-snug'
        : 'start-1.5 bottom-1.5 rounded-md px-1.5 py-0.5 text-[10px] leading-4 sm:text-xs sm:leading-snug',
    ),
    /** Icon-only mute on dock/PiP chips; full-view shows the word when space allows. */
    muteTextSrOnly: !input.isFullView,
  };
}
