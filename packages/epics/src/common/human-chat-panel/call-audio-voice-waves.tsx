'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@hypha-platform/ui-utils';

/** Match {@link ChatVoiceAudioRow} bar count for a consistent “voice” readout. */
const WAVE_BARS = 12;

const WAVE_BARS_SEED = [
  0.32, 0.72, 0.4, 0.95, 0.5, 0.78, 0.35, 0.62, 0.45, 0.28, 0.85, 0.42,
] as const;

type AnalysisHandle = {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
};

function usePrefersReducedMotion(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setM(mq.matches);
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return m;
}

function resumeAudioContextIfNeeded(ctx: globalThis.BaseAudioContext) {
  if (ctx.state !== 'suspended') {
    return;
  }
  const ac = ctx as globalThis.AudioContext;
  if (typeof ac.resume === 'function') {
    void ac.resume();
  }
}

type CallAudioVoiceWavesProps = {
  /**
   * Call feed audio: when `active` and a track exists, we analyse this stream
   * (not CSS keyframes) so bars track real energy like {@link ChatVoiceAudioRow}.
   */
  mediaStream: MediaStream | null;
  /** In speaking mode: caller passes `feed.isSpeaking()`-style gating. */
  active: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onDarkScrim?: boolean;
};

function sizeBounds(size: 'sm' | 'md' | 'lg'): {
  minPx: number;
  maxPx: number;
} {
  if (size === 'sm') {
    return { minPx: 3, maxPx: 12 };
  }
  if (size === 'lg') {
    return { minPx: 8, maxPx: 52 };
  }
  return { minPx: 4, maxPx: 22 };
}

/**
 * In-call “camera off” / audio-only bars: time-domain energy in 12 equal slices
 * of the analyser window (entire buffer), smoothed in rAF — not an infinite
 * `scaleY` keyframe (which only staggered the left and ignored real levels).
 */
export function CallAudioVoiceWaves({
  mediaStream,
  active,
  className,
  size = 'md',
  onDarkScrim = false,
}: CallAudioVoiceWavesProps) {
  const id = useId();
  const { minPx, maxPx } = sizeBounds(size);
  const [levels, setLevels] = useState(() =>
    WAVE_BARS_SEED.map((h) => minPx + h * (maxPx - minPx)),
  );
  const reduceMotion = usePrefersReducedMotion();
  const analysisRef = useRef<AnalysisHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeBufRef = useRef<Uint8Array | null>(null);
  const smoothRef = useRef(WAVE_BARS_SEED.map(() => 0));
  const lastTRef = useRef(0);

  const gap = size === 'sm' ? 'gap-0.5' : size === 'lg' ? 'gap-1' : 'gap-0.5';
  const barWidth =
    size === 'lg'
      ? 'w-1 min-w-[3px] max-w-[4px]'
      : 'w-0.5 min-w-[2px] max-w-[3px]';
  const barActive = onDarkScrim
    ? size === 'lg'
      ? 'bg-emerald-300/95 shadow-sm shadow-emerald-400/30'
      : 'bg-emerald-200/90 shadow-sm shadow-white/10'
    : size === 'lg'
    ? 'bg-emerald-400/95 shadow-sm shadow-emerald-500/25'
    : 'bg-primary/80';
  const barIdle = onDarkScrim ? 'bg-zinc-500/55' : 'bg-muted-foreground/30';
  const rowH =
    size === 'sm' ? 'h-4' : size === 'lg' ? 'h-16 min-h-[3rem] sm:h-20' : 'h-7';

  const buildAnalysis = useCallback((stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) {
      return null;
    }
    if (typeof window === 'undefined') {
      return null;
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
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      timeBufRef.current = new Uint8Array(analyser.fftSize);
      return { ctx, source, analyser } satisfies AnalysisHandle;
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

  const teardown = useCallback(() => {
    stopLoop();
    if (analysisRef.current) {
      try {
        analysisRef.current.source.disconnect();
      } catch {
        /* ignore */
      }
      void analysisRef.current.ctx.close();
      analysisRef.current = null;
    }
    timeBufRef.current = null;
    smoothRef.current = WAVE_BARS_SEED.map(() => 0);
  }, [stopLoop]);

  useEffect(() => {
    teardown();
    setLevels(WAVE_BARS_SEED.map((h) => minPx + h * (maxPx - minPx)));
  }, [mediaStream, minPx, maxPx, teardown]);

  useEffect(() => {
    const canRun =
      active && mediaStream && mediaStream.getAudioTracks().length > 0;
    if (!canRun) {
      teardown();
      setLevels(WAVE_BARS_SEED.map((h) => minPx + h * (maxPx - minPx)));
      return;
    }
    if (reduceMotion) {
      teardown();
      setLevels(WAVE_BARS_SEED.map((h) => minPx + h * 0.55 * (maxPx - minPx)));
      return;
    }

    teardown();
    const handle = buildAnalysis(mediaStream!);
    if (!handle) {
      return;
    }
    analysisRef.current = handle;
    const { analyser } = handle;
    const data = timeBufRef.current;
    if (!data || data.length !== analyser.fftSize) {
      timeBufRef.current = new Uint8Array(analyser.fftSize);
    }
    const buf = timeBufRef.current!;

    const run = (now: number) => {
      rafRef.current = requestAnimationFrame(run);
      if (now - lastTRef.current < 28) {
        return;
      }
      lastTRef.current = now;

      resumeAudioContextIfNeeded(handle.ctx);
      analyser.getByteTimeDomainData(buf);

      const tMix = 0.42;
      const out: number[] = [];
      for (let i = 0; i < WAVE_BARS; i += 1) {
        const from = Math.floor((i / WAVE_BARS) * buf.length);
        const to = Math.floor(((i + 1) / WAVE_BARS) * buf.length);
        let sum = 0;
        let c = 0;
        for (let j = from; j < to; j += 1) {
          const v = (buf[j]! - 128) / 128;
          sum += v * v;
          c += 1;
        }
        const rms = c > 0 ? Math.sqrt(sum / c) : 0;
        const frame = Math.min(1, rms * 2.8);
        const prev = smoothRef.current[i] ?? 0;
        const mix = tMix * frame + (1 - tMix) * prev;
        smoothRef.current[i] = mix;
        out.push(minPx + mix * (maxPx - minPx));
      }
      setLevels(out);
    };

    rafRef.current = requestAnimationFrame((t) => {
      lastTRef.current = t;
      run(t);
    });

    return () => {
      teardown();
    };
  }, [
    active,
    mediaStream,
    reduceMotion,
    minPx,
    maxPx,
    buildAnalysis,
    stopLoop,
    teardown,
  ]);

  return (
    <div
      data-hypha-call-voice-waves=""
      className={cn(
        'flex min-w-0 items-end justify-center',
        gap,
        rowH,
        className,
      )}
      aria-hidden
    >
      {WAVE_BARS_SEED.map((h, i) => {
        const heightPx = Math.round(levels[i] ?? minPx + h * (maxPx - minPx));
        return (
          <span
            key={`${id}bar${String(i)}`}
            className={cn(
              'inline-block origin-bottom rounded-full transition-[height,background-color] duration-100 ease-out',
              barWidth,
              active && !reduceMotion ? barActive : barIdle,
            )}
            style={{ height: `${heightPx}px` }}
          />
        );
      })}
    </div>
  );
}
