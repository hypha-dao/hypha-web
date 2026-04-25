'use client';

import { cn } from '@hypha-platform/ui-utils';

const WAVE_BARS = [
  0.32, 0.72, 0.4, 0.95, 0.5, 0.78, 0.35, 0.62, 0.45, 0.28, 0.85, 0.42,
];

type CallAudioVoiceWavesProps = {
  active: boolean;
  className?: string;
  /** In-call: `sm` = PiP, `md` = sidebar, `lg` = full view / main tile. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Bars sit on a fixed **dark** call tile. Use theme-independent light fills so
   * `primary` / `muted-foreground` (theme tokens) are never “dark on black”.
   */
  onDarkScrim?: boolean;
};

/**
 * Same visual language as {@link ChatVoiceAudioRow} (Telegram-style bars), for in-call
 * “camera off” / audio-only tiles when the remote/local feed reports speaking.
 */
export function CallAudioVoiceWaves({
  active,
  className,
  size = 'md',
  onDarkScrim = false,
}: CallAudioVoiceWavesProps) {
  const hMax = size === 'sm' ? 10 : size === 'lg' ? 22 : 12;
  const hScale = size === 'sm' ? 8 : size === 'lg' ? 34 : 14;
  const gap = size === 'sm' ? 'gap-0.5' : size === 'lg' ? 'gap-1' : 'gap-0.5';
  const barWidth =
    size === 'lg'
      ? 'w-1 min-w-[3px] max-w-[4px]'
      : 'w-0.5 min-w-[2px] max-w-[3px]';
  const barActive = onDarkScrim
    ? size === 'lg'
      ? 'bg-emerald-300/95 motion-safe:will-change-transform shadow-sm shadow-emerald-400/30'
      : 'bg-emerald-200/90 motion-safe:will-change-transform shadow-sm shadow-white/10'
    : size === 'lg'
    ? 'bg-emerald-400/95 motion-safe:will-change-transform shadow-sm shadow-emerald-500/25'
    : 'bg-primary/80 motion-safe:will-change-transform';
  const barIdle = onDarkScrim ? 'bg-zinc-500/55' : 'bg-muted-foreground/30';

  return (
    <>
      <style>{`
        @keyframes hypha-call-voice-wave-bar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1.28); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-hypha-call-voice-waves] span {
            animation: none !important;
          }
        }
      `}</style>
      <div
        data-hypha-call-voice-waves=""
        className={cn(
          'flex min-w-0 items-end justify-center',
          gap,
          size === 'sm'
            ? 'h-4'
            : size === 'lg'
            ? 'h-12 min-h-[2.5rem] sm:h-14'
            : 'h-7',
          className,
        )}
        aria-hidden
      >
        {WAVE_BARS.map((h, i) => {
          const heightPx = Math.round(hMax + h * hScale);
          return (
            <span
              key={`w-${String(h)}-${String(i)}`}
              className={cn(
                'inline-block origin-bottom rounded-full',
                barWidth,
                active ? barActive : barIdle,
              )}
              style={{
                height: `${heightPx}px`,
                ...(active
                  ? {
                      animationName: 'hypha-call-voice-wave-bar',
                      animationDuration: size === 'lg' ? '0.5s' : '0.55s',
                      animationTimingFunction: 'ease-in-out',
                      animationIterationCount: 'infinite',
                      animationDelay: `${i * 38}ms`,
                    }
                  : {}),
              }}
            />
          );
        })}
      </div>
    </>
  );
}
