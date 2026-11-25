'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Info, Loader2, X } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

import {
  resolveCallShareQualityReason,
  type CallShareQualityOption,
} from './call-share-quality-options';
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
 * Remote screenshare quality overlay (#2427): an "Improving quality…" pill while the picture
 * sharpens, and a small resolution badge that can be hidden (choice remembered).
 */
export function CallShareQualityOverlay({
  phase,
  receivedWidth,
  receivedHeight,
  compact,
  t,
  picker,
}: {
  phase: CallShareQualityPhase;
  receivedWidth: number;
  receivedHeight: number;
  /** Receive-quality picker (#2742); omitted = badge only, as in slice 1. */
  picker?: {
    options: CallShareQualityOption[];
    selectedId: string;
    limitedByNetwork: boolean;
    onSelect: (option: CallShareQualityOption) => void;
  };
  /** Small windows (Document PiP, dock thumbnail): loader only, no resolution text. */
  compact?: boolean;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = picker?.options.find((o) => o.id === picker.selectedId);
  const manual = Boolean(selected && selected.kind === 'layer');
  const reason = picker
    ? resolveCallShareQualityReason({
        phase,
        manual,
        limitedByNetwork: picker.limitedByNetwork,
      })
    : null;
  const reasonText =
    reason === 'auto'
      ? t('callShareQualityReasonAuto')
      : reason === 'capped' && selected?.kind === 'layer'
      ? t('callShareQualityReasonCapped', { label: selected.label })
      : reason === 'limited-by-network'
      ? t('callShareQualityReasonNetwork')
      : null;

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-[9] flex max-w-[calc(100%-1rem)] flex-col items-end gap-1">
      {improving ? (
        <div
          role="status"
          className="flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs text-white"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          <span>{t('callShareQualityImproving')}</span>
        </div>
      ) : null}
      {!compact && resolution ? (
        hidden ? (
          <button
            type="button"
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
            {picker && picker.options.length > 1 ? (
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center gap-0.5 rounded-full px-1 py-0.5 hover:bg-white/20"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                aria-label={t('callShareQualityPicker')}
                title={t('callShareQualityPicker')}
              >
                <span>
                  {selected?.kind === 'layer'
                    ? selected.label
                    : t('callShareQualityAuto')}
                </span>
                <ChevronDown className="h-3 w-3" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
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
      {!compact && picker && pickerOpen && !hidden ? (
        <ul
          role="listbox"
          aria-label={t('callShareQualityPicker')}
          className="pointer-events-auto min-w-[9rem] rounded-lg bg-black/80 p-1 text-xs text-white shadow-lg"
        >
          {picker.options.map((option) => {
            const disabled = option.kind === 'layer' && option.needsResize;
            const isSelected = option.id === picker.selectedId;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled}
                  onClick={() => {
                    picker.onSelect(option);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left',
                    disabled
                      ? 'cursor-not-allowed text-white/40'
                      : 'hover:bg-white/20',
                  )}
                >
                  <span>
                    {option.kind === 'auto'
                      ? t('callShareQualityAuto')
                      : option.label}
                    {disabled ? (
                      <span className="ml-1 text-white/50">
                        · {t('callShareQualityNeedsResize')}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
