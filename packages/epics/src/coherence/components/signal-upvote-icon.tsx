import { ArrowBigUp } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';

type SignalUpvoteIconProps = {
  className?: string;
  /** Filled when the viewer has already upvoted. */
  active?: boolean;
};

/** Classic up-arrow affordance for signal voting power. */
export function SignalUpvoteIcon({
  className,
  active = false,
}: SignalUpvoteIconProps) {
  return (
    <ArrowBigUp
      className={cn('shrink-0', className)}
      strokeWidth={2}
      fill={active ? 'currentColor' : 'none'}
      aria-hidden
    />
  );
}
