'use client';

import type {
  Deal,
  PipelineStageDefinition,
  ProbabilityMatrix,
} from '@hypha-platform/core/client';
import { type PipelineStatus } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { KanbanColumn } from './kanban-column';
import { PIPELINE_SWIMLANE_STATUS_ROW_CLASS } from '../utils/pipeline-board-layout';

type KanbanBoardProps = {
  deals: Deal[];
  stages: PipelineStageDefinition[];
  onDealClick?: (deal: Deal) => void;
  onMoveStatus: (dealId: number, status: PipelineStatus) => void;
  activeDealId?: number | null;
  wide?: boolean;
  probabilities?: ProbabilityMatrix;
};

export function KanbanBoard({
  deals,
  stages,
  onDealClick,
  onMoveStatus,
  activeDealId,
  wide = false,
  probabilities,
}: KanbanBoardProps) {
  return (
    <div
      className={cn(
        'flex w-full min-w-0',
        wide
          ? 'items-start overflow-x-auto pb-3 pt-0.5'
          : cn('min-h-0 overflow-x-auto', PIPELINE_SWIMLANE_STATUS_ROW_CLASS),
      )}
    >
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.slug}
          status={stage.slug}
          label={stage.name}
          deals={deals.filter((d) => d.pipelineStatus === stage.slug)}
          onDealClick={onDealClick}
          onDropDeal={onMoveStatus}
          activeDealId={activeDealId}
          wide={wide}
          probabilities={probabilities}
          stages={stages}
        />
      ))}
    </div>
  );
}
