'use client';

import { cn } from '@hypha-platform/ui-utils';
import { clampAxis } from '../wellbeing-model';

type WellbeingGaugeProps = {
  score: number | null;
  comparisonScore?: number | null;
  activated: boolean;
  innerLabel: string;
  outerLabel: string;
  sadLabel: string;
  happyLabel: string;
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

export function WellbeingGauge({
  score,
  comparisonScore = null,
  activated,
  innerLabel,
  outerLabel,
  sadLabel,
  happyLabel,
  className,
}: WellbeingGaugeProps) {
  const displayScore = score ?? 50;
  const cx = 120;
  const cy = 128;
  const innerR = 70;
  const outerR = 98;
  const pointer = polar(cx, cy, innerR, displayScore);
  const world =
    comparisonScore != null ? polar(cx, cy, outerR, comparisonScore) : null;
  const innerSweep = Math.max(0.04, displayScore / 100);
  const arcLen = Math.PI * innerR;

  return (
    <svg
      viewBox="0 0 240 156"
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
        d="M22 128 A98 98 0 0 1 218 128"
        fill="none"
        stroke="var(--neutral-6)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <text
        x="18"
        y="148"
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: '11px' }}
      >
        {sadLabel}
      </text>
      <text
        x="222"
        y="148"
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: '11px' }}
      >
        {happyLabel}
      </text>
      <circle
        cx="22"
        cy="128"
        r="9"
        fill="var(--background-2)"
        stroke="var(--neutral-7)"
      />
      <path
        d="M19 126 a3.2 3.2 0 0 1 6 0"
        fill="none"
        stroke="var(--neutral-11)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="20.6" cy="125.2" r="0.7" fill="var(--neutral-11)" />
      <circle cx="23.4" cy="125.2" r="0.7" fill="var(--neutral-11)" />
      <circle
        cx="218"
        cy="128"
        r="9"
        fill="var(--background-2)"
        stroke="var(--neutral-7)"
      />
      <path
        d="M215 129.6 a3.2 3.2 0 0 1 6 0"
        fill="none"
        stroke="var(--neutral-11)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="216.6" cy="125.2" r="0.7" fill="var(--neutral-11)" />
      <circle cx="219.4" cy="125.2" r="0.7" fill="var(--neutral-11)" />

      <path
        d="M50 128 A70 70 0 0 1 190 128"
        fill="color-mix(in oklab, var(--accent-9) 18%, var(--background-2))"
      />
      <path
        d="M50 128 A70 70 0 0 1 190 128"
        fill="none"
        stroke="var(--accent-9)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${innerSweep * arcLen} ${arcLen}`}
      />
      <text
        x={cx}
        y={cy - 18}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: '34px', fontWeight: 600 }}
      >
        {activated ? displayScore : '—'}
      </text>
      <polygon
        points={`${pointer.x},${pointer.y - 8} ${pointer.x + 5},${
          pointer.y + 4
        } ${pointer.x - 5},${pointer.y + 4}`}
        fill="var(--accent-12)"
      />
      {world ? (
        <g transform={`translate(${world.x}, ${world.y})`}>
          <circle
            r="8.5"
            fill="var(--background-1)"
            stroke="var(--neutral-9)"
          />
          <circle
            r="5.2"
            fill="none"
            stroke="var(--neutral-11)"
            strokeWidth="1.1"
          />
          <ellipse
            rx="5.2"
            ry="2.2"
            fill="none"
            stroke="var(--neutral-11)"
            strokeWidth="1.1"
          />
          <path
            d="M0 -5.2 V5.2 M-5.2 0 H5.2"
            fill="none"
            stroke="var(--neutral-11)"
            strokeWidth="1.1"
          />
        </g>
      ) : null}
    </svg>
  );
}
