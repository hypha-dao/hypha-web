'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, Loader2, X } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

import { resolveCallShareQualityReason } from './call-share-quality-options';
import {
  formatCallShareResolution,
  type CallShareQualityPhase,
} from './call-share-quality-state';

const HIDDEN_STORAGE_KEY = 'hypha.call.shareQualityBadge.hidden';

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(HIDDEN_STORAGE_KEY, '1');
    else window.localStorage.removeItem(HIDDEN_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this tile only.
  }
}

/**
 * Remote screenshare quality overlay (#2427): a small resolution badge that can be hidden (choice
 * remembered), with an "Improving quality…" pill below it while the picture sharpens. The badge sits
 * on top so it does not jump when the pill comes and goes. Its buttons carry
 * `data-call-badge-control` so they stay clickable in the dock, where the stage is click-locked.
 */
export function CallShareQualityOverlay({
  phase,
  receivedWidth,
  receivedHeight,
  compact,
  t,
  reason,
}: {
  phase: CallShareQualityPhase;
  receivedWidth: number;
  receivedHeight: number;
  /** Small windows (Document PiP, dock thumbnail): loader only, no resolution text. */
  compact?: boolean;
  /** Short reason next to the resolution (#2742); omitted = resolution only, as in slice 1. */
  reason?: {
    /** Label of the viewer's cap ("720p"); undefined = Auto. */
    manualLabel?: string;
    limitedByNetwork: boolean;
  };
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(readHidden());
  }, []);
  const updateHidden = useCallback((next: boolean) => {
    setHidden(next);
    writeHidden(next);
  }, []);

  const resolution = formatCallShareResolution(receivedWidth, receivedHeight);
  const improving = phase === 'starting' || phase === 'improving';
  const reasonKind = reason
    ? resolveCallShareQualityReason({
        phase,
        manual: Boolean(reason.manualLabel),
        limitedByNetwork: reason.limitedByNetwork,
      })
    : null;
  const reasonText =
    reasonKind === 'auto'
      ? t('callShareQualityReasonAuto')
      : reasonKind === 'capped' && reason?.manualLabel
      ? t('callShareQualityReasonCapped', { label: reason.manualLabel })
      : reasonKind === 'limited-by-network'
      ? t('callShareQualityReasonNetwork')
      : null;

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-[9] flex max-w-[calc(100%-1rem)] flex-col items-end gap-1">
      {!compact && resolution ? (
        hidden ? (
          <button
            type="button"
            data-call-badge-control
            onClick={() => updateHidden(false)}
            className="pointer-events-auto rounded-full bg-black/45 p-1 text-white/80 hover:bg-black/65 hover:text-white"
            aria-label={t('callShareQualityShow')}
            title={t('callShareQualityShow')}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <div
            className={cn(
              'pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 py-0.5 pl-2.5 pr-1 text-xs text-white/90',
            )}
          >
            <span className="tabular-nums">{resolution}</span>
            {reasonText ? (
              <span className="text-white/70">· {reasonText}</span>
            ) : null}
            <button
              type="button"
              data-call-badge-control
              onClick={() => updateHidden(true)}
              className="rounded-full p-0.5 hover:bg-white/20"
              aria-label={t('callShareQualityHide')}
              title={t('callShareQualityHide')}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </div>
        )
      ) : null}
      {improving ? (
        <div
          role="status"
          className="flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs text-white"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          <span>{t('callShareQualityImproving')}</span>
        </div>
      ) : null}
    </div>
  );
}
