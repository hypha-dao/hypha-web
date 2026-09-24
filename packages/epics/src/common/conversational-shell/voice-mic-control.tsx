'use client';

import * as React from 'react';
import { Loader2, Mic, MicOff, Square } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

import type { CoherentVoiceState } from './use-coherent-voice';

export interface VoiceMicControlProps {
  voice: CoherentVoiceState;
  /** #2486 M10 — the mic sits on the teal waveform panel: white circle, teal icon. */
  onAccent?: boolean;
  className?: string;
}

/**
 * #2486 M8 — the mic toggle in the interaction bar. Voice is never auto-started:
 * on load the button sits in an "off but available" state with a soft invite
 * pulse. One click opens a hands-free session (the mic-permission prompt happens
 * on that click). Icon states: connecting / listening / assistant-speaking —
 * and while the assistant speaks the button doubles as a "stop talking" control.
 */
export function VoiceMicControl({
  voice,
  onAccent = false,
  className,
}: VoiceMicControlProps) {
  // On the teal waveform panel the button is always a white circle with a teal
  // icon — it must not switch to the primary fill on "listening".
  const accentSkin = onAccent
    ? 'rounded-full bg-white text-accent-9 hover:bg-white/90'
    : undefined;

  if (!voice.available) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        aria-label="Voice (unavailable)"
        title="Voice isn't available right now"
        className={cn(accentSkin, className)}
      >
        <MicOff className="size-4 opacity-40" />
      </Button>
    );
  }

  const speaking = voice.phase === 'speaking';
  // "Off but available" — the member hasn't opted in yet (always the state on a
  // fresh page load / reload).
  const idle = !voice.sessionOn && !voice.connecting;

  const label = voice.connecting
    ? 'Connecting…'
    : speaking
    ? 'Stop talking'
    : voice.listening
    ? 'End voice'
    : 'Talk to Coherent';

  return (
    <Button
      type="button"
      variant={
        onAccent ? 'ghost' : voice.listening || speaking ? 'default' : 'ghost'
      }
      size="icon"
      onClick={speaking ? voice.stopSpeaking : voice.toggle}
      aria-pressed={voice.sessionOn}
      aria-label={label}
      title={label}
      className={cn(
        // Live listening: strong pulse, in concert with the waveform bar.
        voice.listening && !speaking && 'animate-pulse',
        accentSkin,
        className,
      )}
    >
      {voice.connecting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : speaking ? (
        <Square className="size-4" />
      ) : voice.listening ? (
        <Mic className="size-4" />
      ) : (
        // Soft invite pulse to call attention to an un-started session.
        <Mic className={cn('size-4 opacity-70', idle && 'animate-pulse')} />
      )}
    </Button>
  );
}
