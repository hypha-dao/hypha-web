'use client';

import React from 'react';
import type { Deal, ProbabilityMatrix } from '@hypha-platform/core/client';
import {
  effectiveSuccessRate,
  type PipelineStatus,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useFormatter } from 'next-intl';
import { DealCard } from './deal-card';
import {
  getDealDragId,
  handleColumnDragOver,
  isDragLeaveColumn,
} from '../utils/deal-dnd-utils';

type KanbanColumnProps = {
  status: PipelineStatus;
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
  onDropDeal: (dealId: number, status: PipelineStatus) => void;
  activeDealId?: number | null;
  wide?: boolean;
  probabilities?: ProbabilityMatrix;
};

export function KanbanColumn({
  status,
  deals,
  onDealClick,
  onDropDeal,
  activeDealId,
  wide = false,
  probabilities,
}: KanbanColumnProps) {
  const columnRef = React.useRef<HTMLDivElement>(null);
  const format = useFormatter();
  const [isOver, setIsOver] = React.useState(false);

  // Deals can carry different currencies; never sum across currencies
  // (same grouping pattern as pipeline-summary.tsx).
  const byCurrency = new Map<string, { total: number; weighted: number }>();
  for (const d of deals) {
    const currency = d.currency || '€';
    const totals = byCurrency.get(currency) ?? { total: 0, weighted: 0 };
    totals.total += d.value;
    totals.weighted += (d.value * effectiveSuccessRate(d, probabilities)) / 100;
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

  return (
    <div
      ref={columnRef}
      className={cn(
        'flex min-h-[220px] shrink-0 flex-col rounded-lg border border-neutral-5 bg-neutral-2/40',
        wide ? 'w-[280px]' : 'w-[220px]',
        isOver && 'border-accent-8 bg-accent-2/30',
      )}
      onDragOver={(event) => {
        handleColumnDragOver(event);
        setIsOver(true);
      }}
      onDragLeave={(event) => {
        if (isDragLeaveColumn(event, columnRef.current)) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const dealId = getDealDragId(event);
        if (dealId != null) {
          onDropDeal(dealId, status);
        }
      }}
    >
      <div className="border-b border-neutral-5 px-3 py-2">
        <div className="text-2 font-medium text-neutral-12">{status}</div>
        <div className="mt-0.5 text-1 text-neutral-11">
          {deals.length} · {formatTotals((totals) => totals.total)} · w{' '}
          {formatTotals((totals) => totals.weighted)}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onClick={onDealClick}
            active={activeDealId === deal.id}
            probabilities={probabilities}
          />
        ))}
      </div>
    </div>
  );
}
