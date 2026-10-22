'use client';

import React from 'react';
import Link from 'next/link';
import {
  filterDeals,
  useDealMutations,
  useDeals,
  usePipelineConfig,
  usePipelineSettings,
  type DealFilters,
  type PipelineStatus,
  type PipelineSwimlane,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { DealCreateFab } from './deal-create-fab';
import { FilterBar } from './filter-bar';
import { SavedViewsMenu } from './saved-views-menu';
import { PipelineSummary } from './pipeline-summary';
import { KanbanBoard } from './kanban-board';
import {
  PipelineLaneSection,
  useCollapsedPipelineLanes,
} from './pipeline-lane-section';
import { NewDealDialog } from './new-deal-dialog';
import { exportDealsToXlsx } from '../utils/export-deals';
import type { UseMembers } from '../../spaces';

type TrackPageProps = {
  spaceSlug: string;
  swimlane: PipelineSwimlane;
  boardHref: string;
  useMembers: UseMembers;
  activeDealId?: number | null;
  onDealOpen: (dealId: number) => void;
};

export function TrackPage({
  spaceSlug,
  swimlane,
  boardHref,
  useMembers,
  activeDealId,
  onDealOpen,
}: TrackPageProps) {
  const t = useTranslations('Pipeline');
  const [filters, setFilters] = React.useState<DealFilters>({ swimlane });
  const [newOpen, setNewOpen] = React.useState(false);
  const { deals, isLoading } = useDeals({ spaceSlug });
  const { moveDealToStatus } = useDealMutations(spaceSlug);
  const { countryFocus } = usePipelineSettings(spaceSlug);
  const { probabilities } = usePipelineConfig(spaceSlug);
  const { collapsedLanes, toggleLane } = useCollapsedPipelineLanes(spaceSlug);

  React.useEffect(() => {
    setFilters((prev) => ({ ...prev, swimlane }));
  }, [swimlane]);

  const filtered = React.useMemo(
    () => filterDeals(deals, filters),
    [deals, filters],
  );

  const onMoveStatus = React.useCallback(
    async (dealId: number, status: PipelineStatus) => {
      const deal = deals.find((d) => d.id === dealId);
      if (!deal || deal.pipelineStatus === status) return;
      await moveDealToStatus(dealId, status);
    },
    [deals, moveDealToStatus],
  );

  return (
    <div className="relative flex min-w-0 flex-col gap-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={boardHref}
            className="text-1 text-accent-11 hover:underline"
          >
            ← {t('backToBoard')}
          </Link>
          <h1 className="craft-page-title text-6 font-medium">
            {t('trackTitle', { swimlane })}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void exportDealsToXlsx(
                filtered,
                `${spaceSlug}-${swimlane}-deals`,
                probabilities,
              );
            }}
          >
            <Download className="mr-1 size-3.5" />
            {t('exportXlsx')}
          </Button>
          <SavedViewsMenu
            spaceSlug={spaceSlug}
            filters={filters}
            onApply={setFilters}
          />
        </div>
      </div>

      <FilterBar
        spaceSlug={spaceSlug}
        filters={filters}
        onChange={setFilters}
        useMembers={useMembers}
        countryFocus={countryFocus}
        lockedSwimlane={swimlane}
      />

      <PipelineSummary deals={filtered} probabilities={probabilities} />

      {isLoading && deals.length === 0 ? (
        <div className="text-2 text-neutral-11">{t('loading')}</div>
      ) : (
        <PipelineLaneSection
          laneSlug={swimlane}
          title={swimlane}
          count={filtered.length}
          collapsed={collapsedLanes.includes(swimlane)}
          onToggle={() => toggleLane(swimlane)}
        >
          <KanbanBoard
            deals={filtered}
            onDealClick={(deal) => onDealOpen(deal.id)}
            onMoveStatus={onMoveStatus}
            activeDealId={activeDealId}
            wide
            probabilities={probabilities}
          />
        </PipelineLaneSection>
      )}

      <DealCreateFab onClick={() => setNewOpen(true)} />
      <NewDealDialog
        spaceSlug={spaceSlug}
        useMembers={useMembers}
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultSwimlane={swimlane}
      />
    </div>
  );
}
