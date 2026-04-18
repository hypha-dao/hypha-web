'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Pause } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

/** Short static “waveform” like Telegram (no real analysis; fits the space). */
const WAVE_BARS = [
  0.35, 0.7, 0.45, 0.9, 0.5, 0.75, 0.4, 0.6, 0.5, 0.35, 0.8, 0.45,
];

function VoiceWaveform({ active }: { active: boolean }) {
  return (
    <div
      data-hypha-voice-waveform=""
      className="flex h-6 min-w-0 flex-1 items-center justify-center gap-0.5"
      aria-hidden
    >
      {WAVE_BARS.map((h, i) => {
        const heightPx = Math.round(12 + h * 14);
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key -- static pattern
            key={i}
            className={cn(
              'inline-block w-0.5 min-w-[2px] max-w-[3px] origin-center rounded-full transition-colors',
              active
                ? 'bg-primary/70 motion-safe:will-change-transform'
                : 'bg-muted-foreground/40',
            )}
            style={{
              height: `${heightPx}px`,
              ...(active
                ? {
                    animationName: 'hypha-voice-wave-bar',
                    animationDuration: '0.55s',
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDelay: `${i * 42}ms`,
                  }
                : {}),
            }}
          />
        );
      })}
    </div>
  );
}

export type ChatVoiceAudioRowProps = {
  /** Audio URL ( MXC HTTP or blob: ). */
  audioSrc: string;
  /** Accessible name + visible duration line. */
  durationLabel: string;
  voiceLabel: string;
  /** Wider cap in timeline; drafts sit in narrow cards — use tighter max. */
  variant?: 'timeline' | 'draft';
  className?: string;
  /** Draft preview: blur row + badge (timeline reveal uses parent overlay). */
  spoilerPreview?: boolean;
  spoilerBadgeLabel?: string;
};

/**
 * Telegram-style compact row: mic (idle) / pause (playing) • waveform • duration.
 */
export function ChatVoiceAudioRow({
  audioSrc,
  durationLabel,
  voiceLabel,
  variant = 'timeline',
  className,
  spoilerPreview = false,
  spoilerBadgeLabel,
}: ChatVoiceAudioRowProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setPlaying(false);
  }, [audioSrc]);

  const row = (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 py-1 pl-1.5 pr-2.5 dark:bg-muted/25',
        variant === 'timeline'
          ? 'max-w-[min(280px,85vw)]'
          : 'w-full max-w-full',
        spoilerPreview && 'scale-[1.02] blur-xl saturate-50',
        className,
      )}
      data-testid="chat-voice-audio-row"
    >
      <style>{`
        @keyframes hypha-voice-wave-bar {
          0%, 100% { transform: scaleY(0.42); }
          50% { transform: scaleY(1.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-hypha-voice-waveform] span {
            animation: none !important;
          }
        }
      `}</style>
      <button
        type="button"
        disabled={spoilerPreview}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-sm ring-1 ring-black/10 transition-opacity hover:opacity-90 dark:bg-black dark:text-white dark:ring-white/15',
          spoilerPreview && 'pointer-events-none opacity-80',
        )}
        aria-label={
          playing ? `Pause ${voiceLabel}` : `${voiceLabel}: play audio`
        }
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (playing) {
            el.pause();
          } else {
            void el.play().catch(() => {});
          }
        }}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
        ) : (
          <Mic className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        )}
      </button>
      <VoiceWaveform active={playing && !spoilerPreview} />
      <span className="shrink-0 tabular-nums text-[11px] font-medium text-muted-foreground">
        {durationLabel}
      </span>
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );

  if (spoilerPreview && spoilerBadgeLabel && variant === 'draft') {
    return (
      <div className="relative w-full">
        {row}
        <div
          className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center rounded-full bg-muted/75"
          aria-hidden
        >
          <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background shadow-sm">
            {spoilerBadgeLabel}
          </span>
        </div>
      </div>
    );
  }

  return row;
}

/** Resolve mm:ss from optional duration ms; fallback for unknown length. */
export function formatVoiceDurationLabel(
  durationMs: number | undefined,
  unknownShort: string,
): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return unknownShort;
  }
  const totalSec = Math.round(durationMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0
    ? `${m}:${String(s).padStart(2, '0')}`
    : `0:${String(s).padStart(2, '0')}`;
}

type DraftVoiceDurationProps = {
  objectUrl: string;
  fallbackLabel: string;
};

/** Load duration from a local blob URL for draft preview. */
export function useDraftVoiceDuration({
  objectUrl,
  fallbackLabel,
}: DraftVoiceDurationProps): string {
  const [label, setLabel] = useState(fallbackLabel);
  useEffect(() => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = objectUrl;
    const onMeta = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        setLabel(formatVoiceDurationLabel(d * 1000, fallbackLabel));
      }
    };
    const onErr = () => setLabel(fallbackLabel);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', onErr);
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', onErr);
      audio.src = '';
    };
  }, [objectUrl, fallbackLabel]);
  return label;
}
