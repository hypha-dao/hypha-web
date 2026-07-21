'use client';

import React from 'react';
import type { Deal } from '@hypha-platform/core/client';
import {
  getDealProbability,
  type PipelineStatus,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
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
};

export function KanbanColumn({
  status,
  deals,
  onDealClick,
  onDropDeal,
  activeDealId,
  wide = false,
}: KanbanColumnProps) {
  const columnRef = React.useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = React.useState(false);

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);
  const weightedValue = deals.reduce(
    (sum, d) =>
      sum + (d.value * getDealProbability(d.pipelineSwimlane, status)) / 100,
    0,
  );
  const currency = deals[0]?.currency ?? '€';

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
          {deals.length} · {currency}
          {totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} ·
          w {currency}
          {weightedValue.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onClick={onDealClick}
            active={activeDealId === deal.id}
          />
        ))}
      </div>
    </div>
  );
}
