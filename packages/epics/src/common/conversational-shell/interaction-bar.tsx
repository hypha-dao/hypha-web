'use client';

import * as React from 'react';
import { Mic, ScrollText, ArrowUp, SquarePen } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

/**
 * Generic conversational interaction bar — the persistent talk-first input surface.
 *
 * On `/[lang]/coherent-intelligent-system` this renders **in place of** the app navbar
 * (#2486 §2.2). M10 rearchitecture: three blocks laid out `space-between` —
 *
 *   [ logo / mode toggle ]  …  [ CENTRE CONTAINER + context/controls ]  …  [ profile ]
 *
 * The centre container is the anchor: the IO's latest reply above a wide
 * teal waveform panel (mic inside), the member's latest input below it, then the
 * text field. Only the last exchange shows. No speaker labels.
 *
 * Presentational only — it knows nothing Hypha-specific: the host passes the
 * logo, mode toggle, scope selector, voice control, waveform visual, transcript
 * content and the profile as nodes. No `@hypha-platform/core|epics` imports.
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

  /** Left block, top: the Hypha wordmark. */
  logoSlot?: React.ReactNode;
  /** Left block, bottom: the interaction ⇄ navigation mode toggle. */
  modeToggleSlot?: React.ReactNode;
  /** Right block, top: the conversational-scope selector (which space). */
  scopeSlot?: React.ReactNode;
  /** Starts a fresh conversation (clears persistence). Absent → no button. */
  onNewConversation?: () => void;
  /** Accessible label for the new-conversation button. */
  newConversationLabel?: string;
  /** Voice control (mic button) — rendered INSIDE the waveform panel. */
  voiceControl?: React.ReactNode;
  /** Waveform / pulse visual — fills the teal panel beside the mic. */
  waveform?: React.ReactNode;
  /** Far-right block: host chrome, e.g. the profile avatar. */
  trailingSlot?: React.ReactNode;

  /** The IO's latest reply — shown above the waveform (M10). IO turns only. */
  lastReplyText?: string;
  /** The member's latest input (typed or spoken) — shown below the waveform. */
  lastUserText?: string;
  /** Shown in the reply slot before any turn (greeting). */
  emptyReplyText?: string;

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
  logoSlot,
  modeToggleSlot,
  scopeSlot,
  onNewConversation,
  newConversationLabel = 'Start a new conversation',
  voiceControl,
  waveform,
  trailingSlot,
  lastReplyText,
  lastUserText,
  emptyReplyText,
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

  const replyText = lastReplyText?.trim() || emptyReplyText?.trim() || '';

  return (
    <div
      className={cn(
        'w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      {/* Expanded transcript region (full width, above the bar). */}
      {historyExpanded && transcriptSlot && (
        <div className="mx-auto max-h-[50vh] w-full max-w-4xl overflow-y-auto px-4 py-3">
          {transcriptSlot}
        </div>
      )}

      {/* Control row — three blocks, space-between. */}
      <div className="mx-auto flex w-full max-w-6xl items-stretch justify-between gap-6 px-4 py-3 lg:gap-10">
        {/* LEFT — wordmark top, mode toggle bottom, centred. */}
        <div className="flex shrink-0 flex-col items-center justify-between gap-3 py-0.5">
          {logoSlot}
          {modeToggleSlot}
        </div>

        {/* MAIN BLOCK — centre container + context / controls. */}
        <div className="flex min-w-0 shrink items-start gap-4">
          {/* Centre container — the anchor. */}
          <div className="flex w-full min-w-0 max-w-2xl flex-col gap-2.5 rounded-xl border border-border bg-background p-3 shadow-sm">
            {/* IO's latest reply. */}
            <div
              key={replyText}
              className="min-h-5 animate-in fade-in slide-in-from-bottom-1 text-sm leading-snug text-foreground duration-300"
            >
              {replyText || <span className="text-muted-foreground">…</span>}
            </div>

            {/* Waveform panel — solid Hypha teal, white content, inverted mic. */}
            <div className="flex items-center gap-3 rounded-xl bg-accent-9 px-3.5 py-3 text-white">
              <div className="min-w-0 flex-1">
                {waveform ?? <DecorativeWaveform active={busy} onAccent />}
              </div>
              {voiceControl ?? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled
                  aria-label="Voice (unavailable)"
                  title="Voice (unavailable)"
                  className="shrink-0 rounded-full bg-white text-accent-9 hover:bg-white/90"
                >
                  <Mic className="size-4 opacity-40" />
                </Button>
              )}
            </div>

            {/* Member's latest input. */}
            {lastUserText?.trim() ? (
              <div
                key={lastUserText}
                className="min-h-4 animate-in fade-in slide-in-from-bottom-1 truncate text-[13px] text-muted-foreground duration-300"
              >
                {lastUserText}
              </div>
            ) : (
              <div className="min-h-4" aria-hidden />
            )}

            {/* Text field. */}
            <div className="flex items-center gap-2 rounded-chrome border border-input bg-background px-3 py-1.5">
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || !text.trim()}
                onClick={submit}
                aria-label="Send"
                title="Send"
                className="size-7 shrink-0"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>

          {/* Context selector on top, controls row below. */}
          <div className="flex shrink-0 flex-col gap-2.5">
            {scopeSlot && <div className="max-w-[13rem]">{scopeSlot}</div>}
            <div className="flex gap-2">
              {onToggleHistory && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onToggleHistory}
                  aria-pressed={historyExpanded}
                  aria-label={historyToggleLabel}
                  title={historyToggleLabel}
                  className={cn(
                    'size-9',
                    historyExpanded && 'border-accent-8 text-accent-11',
                  )}
                >
                  <ScrollText className="size-4" />
                </Button>
              )}
              {onNewConversation && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onNewConversation}
                  aria-label={newConversationLabel}
                  title={newConversationLabel}
                  className="size-9"
                >
                  <SquarePen className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* FAR RIGHT — profile, separated. */}
        {trailingSlot && (
          <div className="shrink-0 self-start py-0.5">{trailingSlot}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Waveform visual. `onAccent` renders white bars for the teal panel; otherwise
 * muted bars. `active` (voice listening/speaking, or a streaming turn) animates.
 */
export function DecorativeWaveform({
  active = false,
  onAccent = false,
}: {
  active?: boolean;
  onAccent?: boolean;
}) {
  return (
    <div
      className="flex h-5 w-full items-center gap-[3px] overflow-hidden"
      aria-hidden
      data-active={active || undefined}
    >
      {WAVE_BARS.map((base, i) => (
        <span
          key={i}
          className={cn(
            'w-1 shrink-0 rounded-full transition-[height,opacity] duration-300',
            onAccent ? 'bg-white' : 'bg-muted-foreground/50',
            active && 'animate-pulse',
          )}
          style={{
            height: active ? `${40 + ((i * 37) % 60)}%` : `${base}%`,
            opacity: onAccent && !active ? 0.7 : 1,
          }}
        />
      ))}
    </div>
  );
}

/** Idle bar heights (%) — a gentle, irregular resting waveform. */
const WAVE_BARS = [
  30, 55, 80, 45, 65, 25, 90, 50, 70, 35, 95, 55, 20, 75, 45, 85, 30, 60, 40,
  90, 50, 25, 70, 45, 80, 35, 60, 90, 30, 55, 65, 25, 80, 45, 60, 35, 85, 40,
  20, 70, 45, 75, 30, 55, 40, 25, 70, 45, 60, 30,
];
