'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** The space empty state: icon, title, explanation, and one action. */
export function SpaceEmptyCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="craft-card flex w-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="craft-icon-box">
        <Icon className="craft-icon" strokeWidth={1.25} aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="craft-page-title text-4 font-medium">{title}</h2>
        <p className="craft-meta">{description}</p>
      </div>
      {action ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}
