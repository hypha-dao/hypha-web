'use client';

import { cn } from '@hypha-platform/ui-utils';

const WAVE_BARS = [
  0.35, 0.7, 0.45, 0.9, 0.5, 0.75, 0.4, 0.6, 0.5, 0.35, 0.8, 0.45,
];

type CallAudioVoiceWavesProps = {
  active: boolean;
  className?: string;
  size?: 'sm' | 'md';
};

/**
 * Same visual language as {@link ChatVoiceAudioRow} (Telegram-style bars), for in-call
 * “camera off” / audio-only tiles when the remote/local feed reports speaking.
 */
export function CallAudioVoiceWaves({
  active,
  className,
  size = 'md',
}: CallAudioVoiceWavesProps) {
  const hMax = size === 'sm' ? 10 : 12;
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-0.5';

  return (
    <>
      <style>{`
        @keyframes hypha-call-voice-wave-bar {
          0%, 100% { transform: scaleY(0.42); }
          50% { transform: scaleY(1.18); }
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
          'flex min-w-0 items-center justify-center',
          gap,
          size === 'md' ? 'h-7' : 'h-4',
          className,
        )}
        aria-hidden
      >
        {WAVE_BARS.map((h, i) => {
          const heightPx = Math.round(hMax + h * (size === 'sm' ? 8 : 14));
          return (
            <span
              key={`w-${String(h)}-${String(i)}`}
              className={cn(
                'inline-block w-0.5 min-w-[2px] max-w-[3px] origin-center rounded-full',
                active
                  ? 'bg-primary/80 motion-safe:will-change-transform'
                  : 'bg-muted-foreground/30',
              )}
              style={{
                height: `${heightPx}px`,
                ...(active
                  ? {
                      animationName: 'hypha-call-voice-wave-bar',
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
    </>
  );
}
