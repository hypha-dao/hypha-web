'use client';

import React from 'react';
import {
  Coherence,
  SignalBoardDefinition,
  SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { SignalTaskCard } from './signal-task-card';
import { useTranslations } from 'next-intl';

type SignalSwimlaneViewProps = {
  signals: Coherence[];
  workflow: SignalWorkflowConfig;
  onSignalClick?: (signal: Coherence) => void;
  onMoveBoard: (signal: Coherence, board: string | null) => Promise<void>;
};

const UNCategorized_SLUG = '__uncategorized__';

export function SignalSwimlaneView({
  signals,
  workflow,
  onSignalClick,
  onMoveBoard,
}: SignalSwimlaneViewProps) {
  const t = useTranslations('CoherenceTab');
  const [draggingSlug, setDraggingSlug] = React.useState<string | null>(null);

  const lanes: Array<{ slug: string; board: SignalBoardDefinition | null }> = [
    ...workflow.boards
      .filter((board) => !board.archived)
      .map((board) => ({ slug: board.slug, board })),
    { slug: UNCategorized_SLUG, board: null },
  ];

  const byBoard = React.useMemo(() => {
    const map = new Map<string, Coherence[]>();
    for (const lane of lanes) map.set(lane.slug, []);
    for (const signal of signals) {
      const key = signal.board ?? UNCategorized_SLUG;
      const bucket = map.get(key) ?? map.get(UNCategorized_SLUG)!;
      bucket.push(signal);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });
    }
    return map;
  }, [lanes, signals]);

  return (
    <div className="flex flex-col gap-3">
      {lanes.map((lane) => {
        const laneSignals = byBoard.get(lane.slug) ?? [];
        return (
          <div
            key={lane.slug}
            className="rounded-xl border border-border/60 bg-muted/10"
            onDragOver={(event) => event.preventDefault()}
            onDrop={async (event) => {
              event.preventDefault();
              const slug = event.dataTransfer.getData('text/signal-slug');
              if (!slug) return;
              const signal = signals.find((item) => item.slug === slug);
              if (!signal) return;
              const nextBoard =
                lane.slug === UNCategorized_SLUG ? null : lane.slug;
              if (signal.board === nextBoard) return;
              await onMoveBoard(signal, nextBoard);
              setDraggingSlug(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
              <span className="text-sm font-semibold">
                {lane.board?.name ?? t('signalBoardUncategorized')}
              </span>
              <span className="text-xs text-muted-foreground">
                {laneSignals.length}
              </span>
            </div>
            <div className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {laneSignals.map((signal) => (
                <SignalTaskCard
                  key={signal.id}
                  signal={signal}
                  status={
                    workflow.statuses.find(
                      (status) => status.slug === signal.progressStatus,
                    ) ?? workflow.statuses[0]
                  }
                  board={lane.board}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/signal-slug', signal.slug);
                    setDraggingSlug(signal.slug);
                  }}
                  onClick={onSignalClick ? () => onSignalClick(signal) : undefined}
                  className={cn(draggingSlug === signal.slug && 'opacity-50')}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
