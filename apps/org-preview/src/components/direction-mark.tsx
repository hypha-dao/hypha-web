import type { CSSProperties } from 'react';
import type { DirectionKind } from '@/lib/data';

/** the heading each direction artifact goes under — card kicker and page title */
export const DIRECTION_LABEL: Record<
  DirectionKind,
  { title: string; question: string }
> = {
  mission: { title: 'Mission', question: 'why we exist' },
  vision: { title: 'Vision', question: 'where we are going' },
  objectives: {
    title: 'Objectives',
    question: 'what we aim to have done soon',
  },
  strategy: { title: 'Strategy', question: 'how we get there' },
};

/** one small line-drawn glyph per artifact, stroked in on load */
export function DirectionMark({
  kind,
  live,
  size = 16,
  style,
}: {
  kind: DirectionKind;
  live?: boolean;
  size?: number;
  style?: CSSProperties;
}) {
  const stroke = live ? 'var(--color-agent)' : 'var(--color-sub)';
  const common = {
    fill: 'none',
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg
      className="dir-mark shrink-0"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      style={style}
    >
      {kind === 'mission' && (
        <>
          {/* a compass needle — why we exist, where north is */}
          <circle cx="8" cy="8" r="6.2" {...common} />
          <path d="M8 3.6 L9.6 8 L8 12.4 L6.4 8 Z" {...common} />
        </>
      )}
      {kind === 'vision' && (
        <>
          {/* horizon with a rising sun */}
          <path d="M2 11.5 H14" {...common} />
          <path d="M4.5 11.5 A3.5 3.5 0 0 1 11.5 11.5" {...common} />
          <path d="M8 4 V5.6 M4 6.2 L5 7.2 M12 6.2 L11 7.2" {...common} />
        </>
      )}
      {kind === 'objectives' && (
        <>
          {/* three lines, the last one short — a list still being worked */}
          <path d="M3 4.5 H13" {...common} />
          <path d="M3 8 H13" {...common} />
          <path d="M3 11.5 H9" {...common} />
        </>
      )}
      {kind === 'strategy' && (
        <>
          {/* a path with a turn — how we get there */}
          <path d="M3 13 C3 8, 8 9, 8 6 C8 3.5, 12 4, 13 3" {...common} />
          <circle cx="3" cy="13" r="1" {...common} />
          <circle cx="13" cy="3" r="1" {...common} />
        </>
      )}
    </svg>
  );
}
