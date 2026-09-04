import type { ReactElement, ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';
import type { StandardCategory, WellbeingDimension } from '../wellbeing-model';

type IconProps = {
  className?: string;
};

const STANDARD_CATEGORY_MARK_SRC: Record<StandardCategory, string> = {
  experience: '/wellbeing/categories/experience.png',
  action: '/wellbeing/categories/action.png',
  emotion: '/wellbeing/categories/emotion.png',
  decision: '/wellbeing/categories/decision.png',
  discovery: '/wellbeing/categories/discovery.png',
};

export function StandardCategoryMark({
  category,
  className,
  pulse = false,
}: IconProps & { category: StandardCategory; pulse?: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0',
        pulse && `wb-pulse-${category}`,
        className,
      )}
    >
      {pulse ? <span className="wb-handle-pulse" aria-hidden /> : null}
      <img
        src={STANDARD_CATEGORY_MARK_SRC[category]}
        alt=""
        draggable={false}
        className="relative z-10 size-full rounded-full object-cover"
      />
    </span>
  );
}

export function StandardCategoryIcon({
  category,
  className,
}: IconProps & { category: StandardCategory }) {
  return <StandardCategoryMark category={category} className={className} />;
}

function heptagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 7 }, (_, index) => {
    const angle = ((90 + (index * 360) / 7) * Math.PI) / 180;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
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
      <circle cx="8.15" cy="8.15" r="4.55" fill="currentColor" />
      <circle cx="15.85" cy="8.15" r="4.55" fill="currentColor" />
      <circle cx="15.85" cy="15.85" r="4.55" fill="currentColor" />
      <circle cx="8.15" cy="15.85" r="4.55" fill="currentColor" />
    </svg>
  );
}

export function IdgCollaboratingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M8.2 5.2H18.8V15.8C18.8 17.2 17.6 18.2 16.2 18.2H5.2V7.8C5.2 6.4 6.4 5.2 8.2 5.2Z"
      />
    </svg>
  );
}

export function IdgActingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M5.2 6.2H14.1L19.4 12L14.1 17.8H5.2Z" />
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
  pulse = true,
}: IconProps & { children: ReactNode; pulse?: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex size-10 items-center justify-center',
        className,
      )}
    >
      {pulse ? <span className="wb-handle-pulse" aria-hidden /> : null}
      <span
        className={cn(
          'relative z-10 flex size-10 items-center justify-center rounded-full border-2 border-background text-white shadow-sm',
          className,
        )}
      >
        {children}
      </span>
    </span>
  );
}
