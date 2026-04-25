'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Mic, Pause } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

const WAVE_BARS = 12;
const WAVE_BARS_SEED = [
  0.35, 0.7, 0.45, 0.9, 0.5, 0.75, 0.4, 0.6, 0.5, 0.35, 0.8, 0.45,
] as const;
const MIN_PX = 4;
const MAX_PX = 28;
const IDLED = WAVE_BARS_SEED.map((h) => MIN_PX + h * (MAX_PX - MIN_PX));

function resumeAudioContextIfNeeded(ctx: globalThis.BaseAudioContext) {
  if (ctx.state !== 'suspended') {
    return;
  }
  const ac = ctx as globalThis.AudioContext;
  if (typeof ac.resume === 'function') {
    void ac.resume();
  }
}

function VoiceWaveformBars({
  active,
  levels,
}: {
  active: boolean;
  levels: number[];
}) {
  const id = useId();
  return (
    <div
      data-hypha-voice-waveform=""
      className="flex h-6 min-w-0 flex-1 items-end justify-center gap-0.5"
      aria-hidden
    >
      {WAVE_BARS_SEED.map((h, i) => {
        const heightPx = active
          ? Math.round(levels[i] ?? MIN_PX + h * (MAX_PX - MIN_PX))
          : Math.round(12 + h * 14);
        return (
          <span
            key={`${id}bar${String(i)}`}
            className={cn(
              'inline-block w-0.5 min-w-[2px] max-w-[3px] origin-bottom rounded-full transition-[height,background-color] duration-100 ease-out',
              active ? 'bg-primary/75' : 'bg-muted-foreground/40',
            )}
            style={{ height: `${heightPx}px` }}
          />
        );
      })}
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setM(mq.matches);
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return m;
}

type VoiceAnalysis = {
  ctx: AudioContext;
  analyser: AnalyserNode;
};

export type ChatVoiceAudioRowProps = {
  audioSrc: string;
  durationLabel: string;
  voiceLabel: string;
  variant?: 'timeline' | 'draft';
  className?: string;
  spoilerPreview?: boolean;
  spoilerBadgeLabel?: string;
};

/**
 * Mic / pause, duration, and bars. While playing, `AnalyserNode` frequency
 * data from the same `<audio>` drives bar height (per-bin peaks + light
 * smoothing). Idle = static silhouette. `prefers-reduced-motion` keeps a fixed
 * mid pattern while playing.
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
  const [levels, setLevels] = useState<number[]>(() => [...IDLED]);
  const reduceMotion = usePrefersReducedMotion();

  const analysisRef = useRef<VoiceAnalysis | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataBufRef = useRef<Uint8Array | null>(null);
  const smoothRef = useRef<number[]>(WAVE_BARS_SEED.map(() => 0));
  const lastTRef = useRef(0);

  const ensureAnalysis = useCallback((audio: HTMLAudioElement) => {
    if (analysisRef.current) {
      return analysisRef.current.analyser;
    }
    const Ctx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    try {
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analysisRef.current = { ctx, analyser };
      dataBufRef.current = new Uint8Array(analyser.frequencyBinCount);
      return analyser;
    } catch {
      return null;
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const teardownAll = useCallback(() => {
    stopLoop();
    if (analysisRef.current) {
      void analysisRef.current.ctx.close();
      analysisRef.current = null;
    }
    dataBufRef.current = null;
    smoothRef.current = WAVE_BARS_SEED.map(() => 0);
  }, [stopLoop]);

  useEffect(() => {
    setPlaying(false);
    setLevels([...IDLED]);
    teardownAll();
  }, [audioSrc, teardownAll]);

  useEffect(() => {
    const canAnimate = playing && !spoilerPreview && !reduceMotion;
    if (!canAnimate) {
      stopLoop();
      smoothRef.current = WAVE_BARS_SEED.map(() => 0);
      if (reduceMotion && playing && !spoilerPreview) {
        setLevels(
          WAVE_BARS_SEED.map((h) => MIN_PX + h * 0.55 * (MAX_PX - MIN_PX)),
        );
      } else {
        setLevels([...IDLED]);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const run = (now: number) => {
      rafRef.current = requestAnimationFrame(run);
      if (now - lastTRef.current < 32) {
        return;
      }
      lastTRef.current = now;

      const a = ensureAnalysis(audio);
      const data = dataBufRef.current;
      if (!a || !data) {
        return;
      }
      resumeAudioContextIfNeeded(a.context);
      a.getByteFrequencyData(data);
      const n = data.length;
      const cut = Math.max(1, Math.floor(n * 0.4));
      const out: number[] = [];
      for (let i = 0; i < WAVE_BARS; i += 1) {
        const from = Math.floor((i / WAVE_BARS) * cut);
        const to = Math.floor(((i + 1) / WAVE_BARS) * cut);
        let peak = 0;
        for (let j = from; j < to; j += 1) {
          if (data[j]! > peak) {
            peak = data[j]!;
          }
        }
        const norm = Math.min(1, peak / 200);
        const t = 0.38;
        const prev = smoothRef.current[i] ?? 0;
        const mix = t * norm + (1 - t) * prev;
        smoothRef.current[i] = mix;
        out.push(MIN_PX + mix * (MAX_PX - MIN_PX));
      }
      setLevels(out);
    };

    rafRef.current = requestAnimationFrame((t) => {
      lastTRef.current = t;
      run(t);
    });

    return () => {
      stopLoop();
    };
  }, [playing, spoilerPreview, reduceMotion, ensureAnalysis, stopLoop]);

  useEffect(
    () => () => {
      teardownAll();
    },
    [teardownAll],
  );

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
          if (!el) {
            return;
          }
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
      <VoiceWaveformBars active={playing && !spoilerPreview} levels={levels} />
      <span className="shrink-0 tabular-nums text-[11px] font-medium text-muted-foreground">
        {durationLabel}
      </span>
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        className="hidden"
        crossOrigin="anonymous"
        playsInline
        onPlay={() => {
          if (!reduceMotion && !analysisRef.current && audioRef.current) {
            const a = ensureAnalysis(audioRef.current);
            if (a) {
              resumeAudioContextIfNeeded(a.context);
            }
          }
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onEnded={() => {
          setPlaying(false);
        }}
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
