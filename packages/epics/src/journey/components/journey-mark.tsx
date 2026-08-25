import { cn } from '@hypha-platform/ui-utils';
import '../journey-surface.css';

export type JourneyMarkKind = 'circles' | 'pulse' | 'moments';

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
