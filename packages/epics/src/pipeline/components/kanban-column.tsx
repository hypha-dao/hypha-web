'use client';

import React from 'react';
import type {
  Deal,
  PipelineStageDefinition,
  ProbabilityMatrix,
} from '@hypha-platform/core/client';
import {
  effectiveSuccessRate,
  type PipelineStatus,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useFormatter, useTranslations } from 'next-intl';
import { DealCard } from './deal-card';
import {
  getDealDragId,
  handleColumnDragOver,
  isDragLeaveColumn,
} from '../utils/deal-dnd-utils';
import {
  PIPELINE_BOARD_COLUMN_SHELL_CLASS,
  PIPELINE_CARD_STACK_CLASS,
  PIPELINE_SWIMLANE_STATUS_COLUMN_CLASS,
} from '../utils/pipeline-board-layout';
import {
  handlePipelineColumnShellWheel,
  handlePipelineColumnWheel,
} from '../utils/pipeline-column-scroll';

type KanbanColumnProps = {
  status: PipelineStatus;
  label?: string;
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
  onDropDeal?: (dealId: number, status: PipelineStatus) => void;
  activeDealId?: number | null;
  wide?: boolean;
  probabilities?: ProbabilityMatrix;
  stages?: PipelineStageDefinition[];
  /** Display only: no drop target, cards are inert. Default off. */
  readOnly?: boolean;
};

export function KanbanColumn({
  status,
  label,
  deals,
  onDealClick,
  onDropDeal,
  activeDealId,
  wide = false,
  probabilities,
  stages,
  readOnly = false,
}: KanbanColumnProps) {
  const columnRef = React.useRef<HTMLDivElement>(null);
  const format = useFormatter();
  const t = useTranslations('Pipeline');
  const [isOver, setIsOver] = React.useState(false);

  // Deals can carry different currencies; never sum across currencies
  // (same grouping pattern as pipeline-summary.tsx).
  const byCurrency = new Map<string, { total: number; weighted: number }>();
  for (const d of deals) {
    const currency = d.currency || '€';
    const totals = byCurrency.get(currency) ?? { total: 0, weighted: 0 };
    totals.total += d.value;
    totals.weighted +=
      (d.value * effectiveSuccessRate(d, probabilities, stages)) / 100;
    byCurrency.set(currency, totals);
  }
  const formatTotals = (
    pick: (totals: { total: number; weighted: number }) => number,
  ): string => {
    if (byCurrency.size === 0) return '€0';
    return [...byCurrency.entries()]
      .map(
        ([currency, totals]) =>
          `${currency}${format.number(pick(totals), {
            maximumFractionDigits: 0,
          })}`,
      )
      .join(' + ');
  };

  const dropHandlers = {
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      handleColumnDragOver(event);
      setIsOver(true);
    },
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      if (isDragLeaveColumn(event, columnRef.current)) {
        setIsOver(false);
      }
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsOver(false);
      const dealId = getDealDragId(event);
      if (dealId != null) {
        onDropDeal?.(dealId, status);
      }
    },
  };

  return (
    <div
      ref={columnRef}
      className={cn(
        'flex flex-col bg-transparent',
        wide
          ? PIPELINE_BOARD_COLUMN_SHELL_CLASS
          : cn(PIPELINE_SWIMLANE_STATUS_COLUMN_CLASS, 'md:min-h-[6rem]'),
        isOver && 'bg-foreground/[0.03]',
      )}
      onWheel={handlePipelineColumnShellWheel}
      {...(readOnly ? {} : dropHandlers)}
    >
      <div className="flex shrink-0 flex-col gap-0.5 border-b border-border/40 px-3 py-2">
        <div className="truncate text-2 font-medium text-neutral-12">
          {label || status}
        </div>
        <div className="min-w-0 break-words text-1 text-neutral-11">
          {deals.length} · {formatTotals((totals) => totals.total)} ·{' '}
          {t('weightedAbbr')} {formatTotals((totals) => totals.weighted)}
        </div>
      </div>
      <div
        data-pipeline-card-stack=""
        className={PIPELINE_CARD_STACK_CLASS}
        onWheel={handlePipelineColumnWheel}
      >
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onClick={onDealClick}
            active={activeDealId === deal.id}
            probabilities={probabilities}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
