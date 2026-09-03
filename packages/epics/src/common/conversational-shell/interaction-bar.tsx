'use client';

import * as React from 'react';
import { Mic, ScrollText, ArrowUp } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

/**
 * Generic conversational interaction bar — the persistent talk-first input surface.
 *
 * On `/[lang]/assistant` this renders **in place of** the app navbar (#2486 §2.2):
 * mode toggle + voice + waveform + history toggle + a trailing app slot (avatar).
 *
 * Presentational only. It knows nothing Hypha-specific: the host passes the mode
 * toggle, the voice control, the waveform visual, the recency/transcript content
 * and the trailing slot as nodes. No `@hypha-platform/core|epics` imports.
 *
 * Milestone 1: static skeleton — the input, the affordances and the slots render;
 * streaming, real voice and the recency-stack animation land in later milestones.
 */
export interface InteractionBarProps {
  /** Controlled text input value. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Fired on Enter (without Shift) or the send button. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Disables the input + send button (e.g. not authenticated, flag off). */
  disabled?: boolean;
  /** Assistant is streaming / awaiting a first token. */
  busy?: boolean;

  /** Leading slot: the interaction <-> navigation mode toggle. */
  modeToggleSlot?: React.ReactNode;
  /** Voice control (mic button). When absent, a decorative disabled mic shows. */
  voiceControl?: React.ReactNode;
  /** Waveform / pulse visual beside the mic. When absent, a static bar shows. */
  waveform?: React.ReactNode;
  /** Trailing slot: host chrome, e.g. the profile avatar. */
  trailingSlot?: React.ReactNode;

  /** Recency stack (last exchange summarised); shown when history is collapsed. */
  recencySlot?: React.ReactNode;
  /** Full scrollable transcript; shown when `historyExpanded`. */
  transcriptSlot?: React.ReactNode;
  historyExpanded?: boolean;
  onToggleHistory?: () => void;
  /** Accessible label for the history toggle. */
  historyToggleLabel?: string;

  className?: string;
}

export function InteractionBar({
  value,
  onValueChange,
  onSubmit,
  placeholder = 'Ask the organization…',
  disabled = false,
  busy = false,
  modeToggleSlot,
  voiceControl,
  waveform,
  trailingSlot,
  recencySlot,
  transcriptSlot,
  historyExpanded = false,
  onToggleHistory,
  historyToggleLabel = 'Toggle conversation history',
  className,
}: InteractionBarProps) {
  const [uncontrolled, setUncontrolled] = React.useState('');
  const isControlled = value !== undefined;
  const text = isControlled ? value : uncontrolled;

  const setText = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const submit = React.useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit?.(trimmed);
    if (!isControlled) setUncontrolled('');
  }, [text, disabled, onSubmit, isControlled]);

  return (
    <div
      className={cn(
        'w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      {/* History region: recency stack (collapsed) or full transcript (expanded). */}
      {(recencySlot || transcriptSlot) && (
        <div
          className={cn(
            'mx-auto w-full max-w-4xl px-4',
            historyExpanded
              ? 'max-h-[50vh] overflow-y-auto py-3'
              : 'py-2 text-sm text-muted-foreground',
          )}
        >
          {historyExpanded ? transcriptSlot : recencySlot}
        </div>
      )}

      {/* Control row. */}
      <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 py-2">
        {modeToggleSlot && <div className="shrink-0">{modeToggleSlot}</div>}

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-chrome border border-input bg-background px-3 py-1.5">
          <input
            type="text"
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={placeholder}
          />

          {/* Waveform + voice control. */}
          <div className="flex shrink-0 items-center gap-1.5">
            {waveform ?? <DecorativeWaveform active={busy} />}
            {voiceControl ?? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled
                aria-label="Voice (unavailable)"
                title="Voice (unavailable)"
              >
                <Mic className="size-4 opacity-40" />
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || !text.trim()}
            onClick={submit}
            aria-label="Send"
            title="Send"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>

        {onToggleHistory && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleHistory}
            aria-pressed={historyExpanded}
            aria-label={historyToggleLabel}
            title={historyToggleLabel}
            className={cn(
              'shrink-0',
              historyExpanded && 'text-accent-foreground',
            )}
          >
            <ScrollText className="size-4" />
          </Button>
        )}

        {trailingSlot && <div className="shrink-0">{trailingSlot}</div>}
      </div>
    </div>
  );
}

/** Static three-bar pulse used until the real waveform lands (voice, milestone 7). */
function DecorativeWaveform({ active = false }: { active?: boolean }) {
  return (
    <div
      className="flex h-4 items-center gap-0.5"
      aria-hidden
      data-active={active || undefined}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-0.5 rounded-full bg-muted-foreground/50 transition-[height] duration-300',
            active ? 'animate-pulse' : '',
          )}
          style={{ height: active ? '100%' : ['40%', '70%', '50%'][i] }}
        />
      ))}
    </div>
  );
}
