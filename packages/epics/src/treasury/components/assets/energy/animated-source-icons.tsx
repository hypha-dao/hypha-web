'use client';

import * as React from 'react';

/**
 * Animated SVG icons for the "Local energy sources" cards. Pure CSS/SVG —
 * no animation deps — and all motion is disabled under
 * `prefers-reduced-motion`.
 */

const STYLE_ID = 'energy-source-anim-styles';

const KEYFRAMES = `
@keyframes energy-src-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes energy-src-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.12); opacity: 0.85; }
}
@keyframes energy-src-charge {
  0% { transform: scaleY(0.12); }
  70% { transform: scaleY(1); }
  85% { transform: scaleY(1); opacity: 1; }
  100% { transform: scaleY(1); opacity: 0.35; }
}
@keyframes energy-src-flash {
  0%, 55%, 100% { opacity: 0.55; }
  70% { opacity: 1; }
}
@keyframes energy-src-ring {
  0% { transform: scale(0.4); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}
.energy-src-spin,
.energy-src-pulse,
.energy-src-charge,
.energy-src-flash,
.energy-src-ring {
  transform-box: fill-box;
  transform-origin: center;
}
.energy-src-spin { animation: energy-src-spin 14s linear infinite; }
.energy-src-pulse { animation: energy-src-pulse 2.6s ease-in-out infinite; }
.energy-src-charge {
  transform-origin: center bottom;
  animation: energy-src-charge 3s ease-in-out infinite;
}
.energy-src-flash { animation: energy-src-flash 3s ease-in-out infinite; }
.energy-src-ring { animation: energy-src-ring 2.4s ease-out infinite; }
.energy-src-ring-delayed { animation-delay: 1.2s; }
@media (prefers-reduced-motion: reduce) {
  .energy-src-spin,
  .energy-src-pulse,
  .energy-src-charge,
  .energy-src-flash,
  .energy-src-ring {
    animation: none;
  }
  .energy-src-ring { opacity: 0; }
}
`;

/** Inject the keyframes once per document instead of once per icon. */
const AnimationStyles = () => {
  React.useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }, []);
  return null;
};

const SolarIcon = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
    <g
      className="energy-src-spin"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <line x1="12" y1="1.5" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22.5" y2="12" />
      <line x1="4.6" y1="4.6" x2="6.4" y2="6.4" />
      <line x1="17.6" y1="17.6" x2="19.4" y2="19.4" />
      <line x1="4.6" y1="19.4" x2="6.4" y2="17.6" />
      <line x1="17.6" y1="6.4" x2="19.4" y2="4.6" />
    </g>
    <circle
      className="energy-src-pulse"
      cx="12"
      cy="12"
      r="4.5"
      fill="currentColor"
    />
  </svg>
);

const BatteryIcon = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
    {/* terminal + case */}
    <rect x="9" y="2" width="6" height="2.4" rx="0.8" fill="currentColor" />
    <rect
      x="6.5"
      y="4.8"
      width="11"
      height="17"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    />
    {/* charge level animating up */}
    <rect
      className="energy-src-charge"
      x="8.6"
      y="7"
      width="6.8"
      height="12.8"
      rx="1"
      fill="currentColor"
      opacity={0.9}
    />
    {/* bolt flash */}
    <path
      className="energy-src-flash"
      d="M12.8 9.5l-3 4.5h2l-0.8 3.5 3.2-4.7h-2.1z"
      fill="#fff"
      stroke="none"
    />
  </svg>
);

const GridIcon = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
    <circle
      className="energy-src-ring"
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
    />
    <circle
      className="energy-src-ring energy-src-ring-delayed"
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
    />
    <path
      className="energy-src-flash"
      d="M13.2 3.5L6.5 13.2h4.3L10 20.5l6.8-9.8h-4.4z"
      fill="currentColor"
    />
  </svg>
);

export const AnimatedSourceIcon = ({
  type,
  accent,
}: {
  type: string;
  accent: string;
}) => (
  <span
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
    style={{ backgroundColor: `${accent}22`, color: accent }}
  >
    <AnimationStyles />
    {type === 'SOLAR' ? (
      <SolarIcon />
    ) : type === 'BATTERY' ? (
      <BatteryIcon />
    ) : (
      <GridIcon />
    )}
  </span>
);
