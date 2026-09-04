import { cn } from '@hypha-platform/ui-utils';
import '../journey-surface.css';

export type JourneyMarkKind = 'circles' | 'pulse' | 'moments' | 'useful';

export function UsefulHarvestArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 72"
      fill="none"
      className={cn('text-accent-11', className)}
      aria-hidden
    >
      <path
        d="M28 46c12 14 32 20 52 20s40-6 52-20"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M40 47c-6-12-4-26 8-32 9-5 20 1 24 11"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M120 47c6-12 4-26-8-32-9-5-20 1-24 11"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <ellipse
        cx="80"
        cy="48"
        rx="26"
        ry="9"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.7"
      />
      <circle
        cx="68"
        cy="28"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle
        cx="86"
        cy="24"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M98 34c4-8 12-10 16-6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

export function JourneyMark({
  kind,
  className,
}: {
  kind: JourneyMarkKind;
  className?: string;
}) {
  return (
    <span
      className={cn('craft-icon-box journey-mark text-accent-11', className)}
      aria-hidden
    >
      {kind === 'circles' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <circle
            cx="9"
            cy="13"
            r="5.25"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle
            cx="15"
            cy="13"
            r="5.25"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle
            cx="12"
            cy="9.5"
            r="4.25"
            stroke="currentColor"
            strokeWidth="1.4"
            opacity="0.55"
          />
        </svg>
      ) : null}
      {kind === 'pulse' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="2.1" fill="currentColor" />
          <circle
            cx="12"
            cy="12"
            r="5.2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle
            cx="12"
            cy="12"
            r="8.4"
            stroke="currentColor"
            strokeWidth="1.4"
            opacity="0.45"
          />
        </svg>
      ) : null}
      {kind === 'useful' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M5 15.2c2.1 2.6 5 3.9 7 3.9s4.9-1.3 7-3.9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M7.2 15.4c-.8-1.6-.6-3.4.6-4.3 1.1-.8 2.6-.3 3.2 1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M16.8 15.4c.8-1.6.6-3.4-.6-4.3-1.1-.8-2.6-.3-3.2 1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle
            cx="10.2"
            cy="9.2"
            r="1.2"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle
            cx="13.8"
            cy="8.6"
            r="1.05"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      ) : null}
      {kind === 'moments' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4.5 16.5A7.5 7.5 0 0 1 19.5 16.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M12 16.5V8.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="12" cy="7.2" r="1.35" fill="currentColor" />
        </svg>
      ) : null}
    </span>
  );
}
