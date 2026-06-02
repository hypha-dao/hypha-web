'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@hypha-platform/ui-utils';

/** Match {@link ChatVoiceAudioRow} bar count for a consistent “voice” readout. */
const WAVE_BARS = 12;

const WAVE_BARS_SEED = [
  0.32, 0.72, 0.4, 0.95, 0.5, 0.78, 0.35, 0.62, 0.45, 0.28, 0.85, 0.42,
] as const;

/** Per-bar gain so the centre reads louder (more satisfying “voice” silhouette). */
const BAR_GAIN = [
  0.72, 0.82, 0.92, 0.98, 1.05, 1.12, 1.12, 1.05, 0.98, 0.92, 0.82, 0.72,
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
    return { minPx: 3, maxPx: 14 };
  }
  if (size === 'lg') {
    return { minPx: 8, maxPx: 52 };
  }
  return { minPx: 4, maxPx: 26 };
}

/**
 * In-call “camera off” / audio-only bars: overall speech energy drives all bars
 * with per-bar seed + phase wobble — uses `--space-accent`.
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
  const freqBufRef = useRef<Uint8Array | null>(null);
  const timeBufRef = useRef<Uint8Array | null>(null);
  const smoothRef = useRef(WAVE_BARS_SEED.map(() => 0));
  const lastTRef = useRef(0);
  const phaseRef = useRef(0);

  const gap = size === 'sm' ? 'gap-0.5' : size === 'lg' ? 'gap-1' : 'gap-0.5';
  const barWidth =
    size === 'lg'
      ? 'w-1 min-w-[3px] max-w-[4px]'
      : 'w-0.5 min-w-[2px] max-w-[3px]';
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
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.35;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      source.connect(analyser);
      freqBufRef.current = new Uint8Array(analyser.frequencyBinCount);
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
    freqBufRef.current = null;
    timeBufRef.current = null;
    smoothRef.current = WAVE_BARS_SEED.map(() => 0);
    phaseRef.current = 0;
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
    const data = freqBufRef.current;
    if (!data || data.length !== analyser.frequencyBinCount) {
      freqBufRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
    if (!timeBufRef.current || timeBufRef.current.length !== analyser.fftSize) {
      timeBufRef.current = new Uint8Array(analyser.fftSize);
    }
    const buf = freqBufRef.current!;
    const timeBuf = timeBufRef.current!;

    const run = (now: number) => {
      rafRef.current = requestAnimationFrame(run);
      if (now - lastTRef.current < 16) {
        return;
      }
      const dt = Math.min(48, now - lastTRef.current);
      lastTRef.current = now;
      phaseRef.current += dt * 0.005;

      resumeAudioContextIfNeeded(handle.ctx);
      analyser.getByteFrequencyData(buf);
      analyser.getByteTimeDomainData(timeBuf);

      /** Speech energy lives in low bins — linear slices leave right bars flat. */
      const speechBins = Math.max(1, Math.floor(buf.length * 0.42));
      let freqPeak = 0;
      let freqSum = 0;
      for (let j = 0; j < speechBins; j += 1) {
        const v = buf[j]! / 255;
        freqSum += v;
        freqPeak = Math.max(freqPeak, v);
      }
      const freqAvg = freqSum / speechBins;

      let rms = 0;
      for (let j = 0; j < timeBuf.length; j += 1) {
        const sample = (timeBuf[j]! - 128) / 128;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / timeBuf.length);

      const voiceLevel = Math.min(
        1,
        freqPeak * 0.55 + freqAvg * 0.85 + rms * 1.15,
      );

      const out: number[] = [];
      for (let i = 0; i < WAVE_BARS; i += 1) {
        const seed = WAVE_BARS_SEED[i] ?? 0.5;
        const gain = BAR_GAIN[i] ?? 1;
        const wobble =
          0.18 * Math.sin(phaseRef.current + i * 0.72) +
          0.1 * Math.sin(phaseRef.current * 1.65 + i * 0.38);
        const frame = Math.min(
          1,
          voiceLevel * seed * gain * (0.68 + wobble) * 1.25,
        );
        const prev = smoothRef.current[i] ?? 0;
        const attack = frame > prev ? 0.62 : 0.28;
        const mix = attack * frame + (1 - attack) * prev;
        smoothRef.current[i] = mix;
        const floor = minPx + 0.12 * (maxPx - minPx);
        out.push(floor + mix * (maxPx - minPx));
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
              'inline-block origin-bottom rounded-full',
              barWidth,
              active && !reduceMotion ? '' : barIdle,
            )}
            style={{
              height: `${heightPx}px`,
              backgroundColor:
                active && !reduceMotion
                  ? 'color-mix(in srgb, var(--space-accent, hsl(var(--primary))) 88%, white)'
                  : undefined,
              boxShadow:
                active && !reduceMotion && onDarkScrim
                  ? '0 0 10px color-mix(in srgb, var(--space-accent, hsl(var(--primary))) 35%, transparent)'
                  : undefined,
              opacity: active && !reduceMotion ? 0.92 + (i % 3) * 0.02 : 1,
            }}
          />
        );
      })}
    </div>
  );
}
