'use client';

import type { ComponentType } from 'react';
import {
  CalendarDays,
  Coins,
  FileCheck2,
  HandCoins,
  House,
  KanbanSquare,
  Navigation,
  Radio,
  UsersRound,
  Zap,
} from 'lucide-react';
import type { SpaceSectionNavKey } from './space-section-nav';

function MemorySectionNavIcon({
  className,
  strokeWidth = 1.25,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
    </svg>
  );
}

/** Shared icon map for space section nav (main tabs + AI left rail). */
export const SPACE_SECTION_NAV_ICONS: Record<
  SpaceSectionNavKey,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  overview: House,
  agreements: FileCheck2,
  members: UsersRound,
  treasury: Coins,
  calendar: CalendarDays,
  coherence: Radio,
  pipeline: KanbanSquare,
  energy: Zap,
  rewards: HandCoins,
  memory: MemorySectionNavIcon,
  'ecosystem-navigation': Navigation,
};
