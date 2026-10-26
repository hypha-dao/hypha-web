'use client';

import { Rows3, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { writeHomeView, type HomeView } from './member-home-view';

const VIEWS = [
  { key: 'ai' as const, icon: Sparkles, labelKey: 'viewAi' as const },
  { key: 'classic' as const, icon: Rows3, labelKey: 'viewClassic' as const },
];

/**
 * Home-only left rail. Same role as the wallet section icons: switch the
 * main view. Spaces stay in At a glance and the mobile tab bar.
 */
export function MemberHomeViewRail({
  view,
  ready,
}: {
  view: HomeView;
  ready: boolean;
}) {
  const t = useTranslations('MemberHome');

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t('viewToggleLabel')}
        className={cn(
          'hidden h-full min-h-0 w-[44px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-background px-0 py-2 xl:flex',
        )}
      >
        {VIEWS.map((item) => {
          const Icon = item.icon;
          const selected = ready && view === item.key;
          const label = t(item.labelKey);
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  disabled={!ready}
                  onClick={() => {
                    if (item.key !== view) writeHomeView(item.key);
                  }}
                  className={cn(
                    'grid size-10 shrink-0 place-items-center text-foreground transition-colors',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    'disabled:opacity-60',
                    selected
                      ? 'border-b border-accent-9'
                      : 'border-b border-transparent hover:text-foreground',
                  )}
                >
                  <Icon
                    className="h-3.5 w-3.5"
                    strokeWidth={1.25}
                    aria-hidden
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
