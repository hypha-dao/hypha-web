'use client';

import { cn } from '@hypha-platform/ui-utils';
import { clampAxis } from '../wellbeing-model';

type WellbeingGaugeProps = {
  score: number | null;
  comparisonScore?: number | null;
  activated: boolean;
  innerLabel: string;
  outerLabel: string;
  className?: string;
};

function polar(cx: number, cy: number, radius: number, score: number) {
  const t = clampAxis(score) / 100;
  const angle = Math.PI * (1 - t);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  };
}

function pointerMark(cx: number, cy: number, radius: number, score: number) {
  const t = clampAxis(score) / 100;
  const angle = Math.PI * (1 - t);
  const nx = Math.cos(angle);
  const ny = -Math.sin(angle);
  const tip = { x: cx + (radius + 5) * nx, y: cy + (radius + 5) * ny };
  const base = { x: cx + (radius - 2.5) * nx, y: cy + (radius - 2.5) * ny };
  const px = -ny;
  const py = nx;
  return `${tip.x},${tip.y} ${base.x + 3.1 * px},${base.y + 3.1 * py} ${
    base.x - 3.1 * px
  },${base.y - 3.1 * py}`;
}

function MouthOnlySmiley({
  cx,
  cy,
  mood,
}: {
  cx: number;
  cy: number;
  mood: 'sad' | 'happy';
}) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <circle
        r="8"
        fill="var(--background-1)"
        stroke="var(--neutral-8)"
        strokeWidth="1.4"
      />
      {mood === 'sad' ? (
        <path
          d="M-3.4 1.8 Q 0 -1.4 3.4 1.8"
          fill="none"
          stroke="var(--neutral-11)"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M-3.4 0.2 Q 0 3.6 3.4 0.2"
          fill="none"
          stroke="var(--neutral-11)"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function WorldGlobe({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r="8.4" fill="var(--neutral-11)" />
      <path
        fill="var(--background-1)"
        d="M-5.4-1.2C-3.8-4.8.2-5.6 2.4-3.6c1.1 1-0.1 2.2-1.6 2.1-1.2-.1-2 .9-1.4 1.8.8 1.2-.6 2.4-1.9 1.7-1.6-.8-2.2-2.8-2.9-2Z"
      />
      <path
        fill="var(--background-1)"
        d="M1.2-2.1C3.4-3.6 6.2-1.8 5.8 1.1 5.5 3.2 3.4 4.4 1.8 3.6 0.4 2.9.1.8 1.2-2.1Z"
      />
      <path
        fill="var(--background-1)"
        d="M-1.8 3.4c1.4.2 2.6 1.6 1.6 2.8-1.2 1.4-3.6.4-3.2-1.2.2-.8.9-1.6 1.6-1.6Z"
      />
    </g>
  );
}

export function WellbeingGauge({
  score,
  comparisonScore = null,
  activated,
  innerLabel,
  outerLabel,
  className,
}: WellbeingGaugeProps) {
  const displayScore = score ?? 50;
  const cx = 120;
  const cy = 128;
  const innerR = 62;
  const outerR = 108;
  const world =
    comparisonScore != null ? polar(cx, cy, outerR, comparisonScore) : null;
  const innerSweep = Math.max(0.04, displayScore / 100);
  const arcLen = Math.PI * innerR;
  const tick = polar(cx, cy, outerR, 50);

  return (
    <svg
      viewBox="0 0 240 148"
      className={cn('w-full', className)}
      role="img"
      aria-label={
        activated
          ? `${innerLabel} ${displayScore}. ${
              comparisonScore != null ? `${outerLabel} ${comparisonScore}.` : ''
            }`
          : innerLabel
      }
    >
      <path
        d="M12 128 A108 108 0 0 1 228 128"
        fill="none"
        stroke="var(--neutral-6)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d={`M${tick.x} ${tick.y - 5} L${tick.x} ${tick.y + 2}`}
        stroke="var(--neutral-8)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      <MouthOnlySmiley cx={12} cy={128} mood="sad" />
      <MouthOnlySmiley cx={228} cy={128} mood="happy" />

      <path
        d="M58 128 A62 62 0 0 1 182 128"
        fill="color-mix(in oklab, var(--accent-9) 18%, var(--background-2))"
      />
      <path
        d="M58 128 A62 62 0 0 1 182 128"
        fill="none"
        stroke="var(--accent-9)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${innerSweep * arcLen} ${arcLen}`}
      />
      <text
        x={cx}
        y={cy - 16}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: '32px', fontWeight: 600 }}
      >
        {activated ? displayScore : '—'}
      </text>
      <polygon
        points={pointerMark(cx, cy, innerR, displayScore)}
        fill="var(--accent-12)"
      />

      {world ? <WorldGlobe x={world.x} y={world.y} /> : null}
    </svg>
  );
}
