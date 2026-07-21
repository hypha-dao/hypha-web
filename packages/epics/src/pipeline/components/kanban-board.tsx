'use client';

import type { Deal } from '@hypha-platform/core/client';
import {
  PIPELINE_STATUSES,
  type PipelineStatus,
} from '@hypha-platform/core/client';
import { KanbanColumn } from './kanban-column';

type KanbanBoardProps = {
  deals: Deal[];
  onDealClick?: (deal: Deal) => void;
  onMoveStatus: (dealId: number, status: PipelineStatus) => void;
  activeDealId?: number | null;
  wide?: boolean;
};

export function KanbanBoard({
  deals,
  onDealClick,
  onMoveStatus,
  activeDealId,
  wide = false,
}: KanbanBoardProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {PIPELINE_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          deals={deals.filter((d) => d.pipelineStatus === status)}
          onDealClick={onDealClick}
          onDropDeal={onMoveStatus}
          activeDealId={activeDealId}
          wide={wide}
        />
      ))}
    </div>
  );
}
