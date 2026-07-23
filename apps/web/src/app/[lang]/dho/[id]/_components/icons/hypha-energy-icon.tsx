import { cn } from '@hypha-platform/ui-utils';

const CX = 12;
const CY = 12;

/** Single vortex blade; duplicated with rotation for the Hypha Energy mark. */
const BLADE_D =
  `M ${(CX + 3.2).toFixed(2)} ${(CY - 0.15).toFixed(2)}` +
  ` Q ${(CX + 6.8).toFixed(2)} ${(CY - 3.4).toFixed(2)} ${(CX + 10.4).toFixed(
    2,
  )} ${(CY - 6.2).toFixed(2)}`;

/**
 * Hypha Energy brand mark — vortex / spiral blades (hypha.energy), stroke-only
 * to align with Lucide icons in action lists (`currentColor`, rounded caps).
 */
export function HyphaEnergyIcon({
  className,
  'aria-hidden': ariaHidden = true,
}: {
  className?: string;
  'aria-hidden'?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={BLADE_D} transform={`rotate(${i * 36} ${CX} ${CY})`} />
      ))}
    </svg>
  );
}
