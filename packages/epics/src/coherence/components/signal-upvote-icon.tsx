import { cn } from '@hypha-platform/ui-utils';

type SignalUpvoteIconProps = {
  className?: string;
  /** Filled accent treatment when the viewer has already upvoted. */
  active?: boolean;
};

/**
 * Lightning bolt with an upward arrow — voting power / boost affordance for signals.
 */
export function SignalUpvoteIcon({
  className,
  active = false,
}: SignalUpvoteIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('shrink-0', className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.5 2.1 9.5 2.1 8 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.15 4.55 5.55 8.65h2.25l-1.25 4.35 4.05-5.05H8.15l1-3.4Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
