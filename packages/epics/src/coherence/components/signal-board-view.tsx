'use client';

import React from 'react';
import {
  Coherence,
  SignalStatusDefinition,
  SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { SignalTaskCard } from './signal-task-card';

type SignalBoardViewProps = {
  signals: Coherence[];
  workflow: SignalWorkflowConfig;
  onSignalClick?: (signal: Coherence) => void;
  onMoveStatus: (signal: Coherence, progressStatus: string) => Promise<void>;
};

export function SignalBoardView({
  signals,
  workflow,
  onSignalClick,
  onMoveStatus,
}: SignalBoardViewProps) {
  const [draggingSlug, setDraggingSlug] = React.useState<string | null>(null);

  const statuses = workflow.statuses.filter((status) => !status.isTerminal || true);

  const byStatus = React.useMemo(() => {
    const map = new Map<string, Coherence[]>();
    for (const status of statuses) {
      map.set(status.slug, []);
    }
    for (const signal of signals) {
      const key = signal.progressStatus ?? statuses[0]?.slug ?? 'backlog';
      const bucket = map.get(key) ?? [];
      bucket.push(signal);
      map.set(key, bucket);
    }
    return map;
  }, [signals, statuses]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statuses.map((status) => {
        const columnSignals = byStatus.get(status.slug) ?? [];
        return (
          <div
            key={status.slug}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-border/60 bg-muted/15"
            onDragOver={(event) => event.preventDefault()}
            onDrop={async (event) => {
              event.preventDefault();
              const slug = event.dataTransfer.getData('text/signal-slug');
              if (!slug) return;
              const signal = signals.find((item) => item.slug === slug);
              if (!signal || signal.progressStatus === status.slug) return;
              await onMoveStatus(signal, status.slug);
              setDraggingSlug(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {status.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {columnSignals.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {columnSignals.map((signal) => (
                <SignalTaskCard
                  key={signal.id}
                  signal={signal}
                  status={status}
                  board={
                    workflow.boards.find((board) => board.slug === signal.board) ??
                    null
                  }
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/signal-slug', signal.slug);
                    setDraggingSlug(signal.slug);
                  }}
                  onClick={onSignalClick ? () => onSignalClick(signal) : undefined}
                  className={cn(
                    draggingSlug === signal.slug && 'opacity-50',
                  )}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
