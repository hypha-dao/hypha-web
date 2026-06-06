import { Phone } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Classic end-call pictogram: handset horizontal, receiver end toward the bottom
 * (distinct from {@link PhoneOff}’s diagonal “slashed” mark).
 */
export function CallHangUpIcon({
  className,
  strokeWidth = 1.75,
  'aria-hidden': ariaHidden = true,
}: {
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}) {
  return (
    <Phone
      className={cn('rotate-90', className)}
      aria-hidden={ariaHidden}
      strokeWidth={strokeWidth}
    />
  );
}
