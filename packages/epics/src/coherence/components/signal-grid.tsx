import Link from 'next/link';
import {
  Coherence,
  resolveEffectiveBoard,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { getSignalSlugDomProps } from '../lib/signal-deep-link-dom';
import { isSignalSlugActive } from '../utils/signal-active-styles';
import {
  SIGNAL_GRID_CARD_WRAPPER_CLASS,
  SIGNAL_GRID_LAYOUT_CLASS,
} from '../utils/signal-board-layout';
import { SignalTaskCard } from './signal-task-card';

type SignalGridProps = {
  isLoading: boolean;
  basePath: string;
  signals: Coherence[];
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
  activeSignalSlug?: string | null;
  workflow?: SignalWorkflowConfig | null;
};

export function SignalGrid({
  basePath,
  signals,
  refresh,
  onSignalClick,
  activeSignalSlug,
  workflow,
}: SignalGridProps) {
  return (
    <div className={SIGNAL_GRID_LAYOUT_CLASS}>
      {signals.map((signal) => {
        const isActive = isSignalSlugActive(signal.slug, activeSignalSlug);
        const board = workflow
          ? workflow.boards.find(
              (item) =>
                item.slug === resolveEffectiveBoard(signal.board, workflow),
            ) ?? null
          : null;
        const card = (
          <SignalTaskCard
            signal={signal}
            className="h-full min-h-0 w-full"
            isActive={isActive}
            refresh={refresh}
            showBoard={Boolean(workflow)}
            board={board}
          />
        );

        if (signal.archived || !onSignalClick) {
          if (signal.archived) {
            return (
              <div key={signal.id} className={SIGNAL_GRID_CARD_WRAPPER_CLASS}>
                {card}
              </div>
            );
          }
          return (
            <Link
              key={signal.id}
              href={`${basePath}/${signal.slug}`}
              {...getSignalSlugDomProps(signal.slug)}
              className={cn(SIGNAL_GRID_CARD_WRAPPER_CLASS, 'rounded-none')}
            >
              {card}
            </Link>
          );
        }

        return (
          <div
            key={signal.id}
            {...getSignalSlugDomProps(signal.slug)}
            role="button"
            tabIndex={0}
            className={cn(
              SIGNAL_GRID_CARD_WRAPPER_CLASS,
              'cursor-pointer rounded-none text-left outline-none',
              'focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
            onClick={() => onSignalClick(signal)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSignalClick(signal);
              }
            }}
          >
            {card}
          </div>
        );
      })}
    </div>
  );
}
