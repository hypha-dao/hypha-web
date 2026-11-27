import type { SVGProps } from 'react';

/**
 * Blur icon (#2563): a dot field fading towards the edges, in the spirit of Material's "blur on"
 * (drawn here, not copied). Lucide has no blur icon, and Sparkles reads as AI. `strong` uses
 * larger dots. Sized and coloured like a Lucide icon (`className`, `currentColor`).
 */
export function CallBlurIcon({
  strong = false,
  ...props
}: SVGProps<SVGSVGElement> & { strong?: boolean }) {
  const steps = [3.5, 8.5, 12, 15.5, 20.5];
  const scale = strong ? 1.3 : 1;
  const dots: Array<{ cx: number; cy: number; r: number }> = [];
  steps.forEach((cx, i) =>
    steps.forEach((cy, j) => {
      const ring = Math.max(Math.abs(i - 2), Math.abs(j - 2));
      const corner = Math.abs(i - 2) === 2 && Math.abs(j - 2) === 2;
      const r =
        (corner ? 0.55 : ring === 2 ? 0.85 : ring === 1 ? 1.3 : 1.7) * scale;
      dots.push({ cx, cy, r });
    }),
  );
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      {dots.map(({ cx, cy, r }) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}
