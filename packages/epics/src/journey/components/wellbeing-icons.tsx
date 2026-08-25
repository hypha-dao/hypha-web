import type { ReactElement, ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';
import type { StandardCategory, WellbeingDimension } from '../wellbeing-model';

type IconProps = {
  className?: string;
};

function heptagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 7 }, (_, index) => {
    const angle = ((-90 + (index * 360) / 7) * Math.PI) / 180;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

export function ExperienceDropletIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 3.2c0 0-5.4 7.4-5.4 11.2a5.4 5.4 0 1 0 10.8 0C17.4 10.6 12 3.2 12 3.2Z"
      />
    </svg>
  );
}

export function ActionFlameIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.8c-.4 3.6-2.6 5.4-4.4 7.6-1.4 1.7-2 3.5-2 5.2a6.4 6.4 0 0 0 12.8 0c0-2.6-1.3-4.6-2.8-6.4-.8 2.2-2.4 3.4-3.4 3.8.4-2.4 1.2-4.6-.2-10.2Z"
      />
    </svg>
  );
}

export function EmotionHeartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12 19.6 5.1 13a4.5 4.5 0 0 1 6.4-6.3L12 7.4l.5-.7a4.5 4.5 0 0 1 6.4 6.3Z"
      />
    </svg>
  );
}

export function DecisionBoltIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M13.4 2.4 6.2 13.2h5.1l-1.2 8.4 8-11.4h-5.1Z"
      />
    </svg>
  );
}

export function DiscoveryPlanetIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="5.2" fill="currentColor" />
      <ellipse
        cx="12"
        cy="12"
        rx="9.2"
        ry="3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        transform="rotate(-22 12 12)"
      />
    </svg>
  );
}

const CATEGORY_ICONS: Record<
  StandardCategory,
  (props: IconProps) => ReactElement
> = {
  experience: ExperienceDropletIcon,
  action: ActionFlameIcon,
  emotion: EmotionHeartIcon,
  decision: DecisionBoltIcon,
  discovery: DiscoveryPlanetIcon,
};

export function StandardCategoryIcon({
  category,
  className,
}: IconProps & { category: StandardCategory }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon className={className} />;
}

export function IdgBeingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="7.2" fill="currentColor" />
    </svg>
  );
}

export function IdgThinkingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <polygon points={heptagonPoints(12, 12, 7.4)} fill="currentColor" />
    </svg>
  );
}

export function IdgRelatingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="7.2" r="4.4" fill="currentColor" />
      <circle cx="16.8" cy="12" r="4.4" fill="currentColor" />
      <circle cx="12" cy="16.8" r="4.4" fill="currentColor" />
      <circle cx="7.2" cy="12" r="4.4" fill="currentColor" />
    </svg>
  );
}

export function IdgCollaboratingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M5.2 5.2h10.2c1.9 0 3.4 1.5 3.4 3.4v10.2H8.6c-1.9 0-3.4-1.5-3.4-3.4Z"
      />
    </svg>
  );
}

export function IdgActingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M4.6 6.2h8.4L19.4 12l-6.4 5.8H4.6Z" />
    </svg>
  );
}

const IDG_ICONS: Record<
  WellbeingDimension,
  (props: IconProps) => ReactElement
> = {
  being: IdgBeingIcon,
  thinking: IdgThinkingIcon,
  relating: IdgRelatingIcon,
  collaborating: IdgCollaboratingIcon,
  acting: IdgActingIcon,
};

export function IdgDimensionIcon({
  dimension,
  className,
}: IconProps & { dimension: WellbeingDimension }) {
  const Icon = IDG_ICONS[dimension];
  return <Icon className={className} />;
}

export function MouthSmiley({
  mood,
  className,
}: IconProps & { mood: 'sad' | 'happy' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {mood === 'sad' ? (
        <path
          d="M8.2 14.6q3.8-3.4 7.6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M8.2 13q3.8 3.6 7.6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function MatrixHandle({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex size-10 items-center justify-center rounded-full border-2 border-background text-white shadow-sm',
        className,
      )}
    >
      {children}
    </span>
  );
}
