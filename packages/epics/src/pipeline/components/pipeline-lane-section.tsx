'use client';

import React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  readCollapsedPipelineLanes,
  toggleCollapsedPipelineLane,
  writeCollapsedPipelineLanes,
} from '../lib/pipeline-lane-collapse';

type PipelineLaneSectionProps = {
  laneSlug: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function useCollapsedPipelineLanes(spaceSlug: string) {
  const [collapsedLanes, setCollapsedLanes] = React.useState<string[]>([]);

  // Read after mount so server and first client render agree.
  React.useEffect(() => {
    if (!spaceSlug) return;
    setCollapsedLanes(readCollapsedPipelineLanes(spaceSlug));
  }, [spaceSlug]);

  const toggleLane = React.useCallback(
    (laneSlug: string) => {
      setCollapsedLanes((current) => {
        const next = toggleCollapsedPipelineLane(current, laneSlug);
        if (spaceSlug) writeCollapsedPipelineLanes(spaceSlug, next);
        return next;
      });
    },
    [spaceSlug],
  );

  return { collapsedLanes, toggleLane };
}

export function PipelineLaneSection({
  laneSlug,
  title,
  count,
  collapsed,
  onToggle,
  actions,
  children,
}: PipelineLaneSectionProps) {
  const t = useTranslations('Pipeline');
  const laneBodyId = `pipeline-lane-${laneSlug}`;

  return (
    <section className="w-full min-w-0 border-b border-border/50">
      <header className="flex shrink-0 items-stretch">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={collapsed ? undefined : laneBodyId}
          title={collapsed ? t('laneExpand') : t('laneCollapse')}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <ChevronRight
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
                !collapsed && 'rotate-90',
              )}
              aria-hidden
            />
            <span
              role="heading"
              aria-level={3}
              className="truncate text-sm font-semibold tracking-tight text-foreground"
            >
              {title}
            </span>
          </span>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        </button>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 pe-1">{actions}</div>
        ) : null}
      </header>
      {collapsed ? null : (
        <div id={laneBodyId} className="min-w-0">
          {children}
        </div>
      )}
    </section>
  );
}
