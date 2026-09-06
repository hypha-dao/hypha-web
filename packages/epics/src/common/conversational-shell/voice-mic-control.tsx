'use client';

import * as React from 'react';
import { Loader2, Mic, MicOff, Square } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

import type { CoherentVoiceState } from './use-coherent-voice';

export interface VoiceMicControlProps {
  voice: CoherentVoiceState;
  className?: string;
}

/**
 * #2486 M8 — the mic toggle in the interaction bar. One click opens a hands-free
 * voice session; the icon reflects the phase (connecting / listening / the
 * assistant speaking). While the assistant is speaking, the button doubles as a
 * "stop talking" control.
 */
export function VoiceMicControl({ voice, className }: VoiceMicControlProps) {
  if (!voice.available) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        aria-label="Voice (unavailable)"
        title="Voice isn't available right now"
        className={className}
      >
        <MicOff className="size-4 opacity-40" />
      </Button>
    );
  }

  const speaking = voice.phase === 'speaking';
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
      variant={voice.listening || speaking ? 'default' : 'ghost'}
      size="icon"
      onClick={speaking ? voice.stopSpeaking : voice.toggle}
      aria-pressed={voice.listening}
      aria-label={label}
      title={label}
      className={cn(voice.listening && !speaking && 'animate-pulse', className)}
    >
      {voice.connecting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : speaking ? (
        <Square className="size-4" />
      ) : voice.listening ? (
        <Mic className="size-4" />
      ) : (
        <Mic className="size-4 opacity-70" />
      )}
    </Button>
  );
}
