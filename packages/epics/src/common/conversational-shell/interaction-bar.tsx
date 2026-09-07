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
  placeholder = 'Ask the Coherent Intelligence…',
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
        {/* LEFT — wordmark + mode toggle, centred vertically. */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 py-0.5">
          {logoSlot}
          {modeToggleSlot}
        </div>

        {/* MAIN BLOCK — centre container + context / controls. */}
        <div className="flex min-w-0 shrink items-center gap-4">
          {/* Centre container — the anchor. */}
          <div className="flex w-full min-w-0 max-w-2xl flex-col gap-2.5 rounded-xl border border-border bg-background p-3 shadow-sm">
            {/* IO's latest reply. */}
            <div
              key={replyText}
              className="min-h-5 animate-in fade-in slide-in-from-bottom-1 text-sm leading-snug text-foreground duration-300"
            >
              {replyText || <span className="text-muted-foreground">…</span>}
            </div>

            {/* Waveform panel — solid Hypha teal, the wave fills full width, the
                inverted mic floats over the right edge. */}
            <div className="relative flex items-center rounded-xl bg-accent-9 px-3.5 py-3 text-white">
              <div className="min-w-0 flex-1">
                {waveform ?? <DecorativeWaveform active={busy} onAccent />}
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {voiceControl ?? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled
                    aria-label="Voice (unavailable)"
                    title="Voice (unavailable)"
                    className="size-9 shrink-0 rounded-full bg-white text-accent-9 shadow-sm hover:bg-white/90"
                  >
                    <Mic className="size-4 opacity-40" />
                  </Button>
                )}
              </div>
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

          {/* Context selector on top, controls row below — centred against the
              container. */}
          <div className="flex shrink-0 flex-col gap-2.5 self-center">
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
          <div className="shrink-0 self-center py-0.5">{trailingSlot}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Waveform visual for the teal panel.
 *
 * - **inactive** → a single flat resting line.
 * - **active** (voice listening/speaking, or a streaming turn) → a lively,
 *   full-width equaliser: each bar rides its own sine on a staggered delay, with
 *   a centre-weighted envelope so it reads as "voice", not a loading bar.
 *
 * `onAccent` picks the palette (white for the teal panel, muted elsewhere).
 */
const WAVE_BAR_COUNT = 56;

export function DecorativeWaveform({
  active = false,
  onAccent = false,
}: {
  active?: boolean;
  onAccent?: boolean;
}) {
  const barColor = onAccent ? 'bg-white' : 'bg-accent-9';

  return (
    <div
      className="relative flex h-6 w-full items-center justify-between"
      aria-hidden
      data-active={active || undefined}
    >
      {/* Resting line — fades out as the bars come alive. */}
      <div
        className={cn(
          'absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-opacity duration-500',
          onAccent ? 'bg-white/45' : 'bg-accent-9/40',
          active ? 'opacity-0' : 'opacity-100',
        )}
      />
      <style>{WAVE_KEYFRAMES}</style>
      {Array.from({ length: WAVE_BAR_COUNT }).map((_, i) => {
        // Centre-weighted envelope: 1 at the middle, ~0.35 at the edges.
        const t = i / (WAVE_BAR_COUNT - 1);
        const env = 0.35 + 0.65 * Math.sin(Math.PI * t);
        return (
          <span
            key={i}
            className={cn(
              'w-[3px] shrink-0 origin-center rounded-full transition-[transform,opacity] duration-500',
              barColor,
            )}
            style={{
              height: '100%',
              transform: active ? undefined : 'scaleY(0.06)',
              opacity: active ? 1 : 0,
              animation: active
                ? `coherent-wave ${820 + (i % 7) * 90}ms ease-in-out ${
                    (i % 11) * 70
                  }ms infinite`
                : undefined,
              // Feeds the keyframe's peak height.
              ['--wave-env' as string]: env.toFixed(3),
            }}
          />
        );
      })}
    </div>
  );
}

const WAVE_KEYFRAMES = `
@keyframes coherent-wave {
  0%, 100% { transform: scaleY(0.14); }
  50% { transform: scaleY(var(--wave-env, 0.8)); }
}
`;
