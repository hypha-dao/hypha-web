'use client';

import React from 'react';
import Link from 'next/link';
import {
  filterDeals,
  PIPELINE_SWIMLANES,
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
import { Plus } from 'lucide-react';
import { FilterBar } from './filter-bar';
import { SavedViewsMenu } from './saved-views-menu';
import { PipelineSummary } from './pipeline-summary';
import { KanbanBoard } from './kanban-board';
import { NewDealDialog } from './new-deal-dialog';
import { exportDealsToXlsx } from '../utils/export-deals';
import type { UseMembers } from '../../spaces';

type IntegratedBoardProps = {
  spaceSlug: string;
  lang: string;
  useMembers: UseMembers;
  activeDealId?: number | null;
  onDealOpen: (dealId: number) => void;
  getTrackHref: (swimlane: PipelineSwimlane) => string;
};

export function IntegratedBoard({
  spaceSlug,
  useMembers,
  activeDealId,
  onDealOpen,
  getTrackHref,
}: IntegratedBoardProps) {
  const t = useTranslations('Pipeline');
  const [filters, setFilters] = React.useState<DealFilters>({});
  const [newOpen, setNewOpen] = React.useState(false);
  const [newSwimlane, setNewSwimlane] =
    React.useState<PipelineSwimlane>('Sales');
  const { deals, isLoading } = useDeals({ spaceSlug });
  const { moveDealToStatus } = useDealMutations(spaceSlug);
  const { countryFocus } = usePipelineSettings(spaceSlug);
  const { probabilities } = usePipelineConfig(spaceSlug);

  const filtered = React.useMemo(
    () => filterDeals(deals, filters),
    [deals, filters],
  );

  const visibleSwimlanes = React.useMemo(() => {
    if (!filters.swimlane) return PIPELINE_SWIMLANES;
    const selected = Array.isArray(filters.swimlane)
      ? filters.swimlane
      : [filters.swimlane];
    return PIPELINE_SWIMLANES.filter((swimlane) => selected.includes(swimlane));
  }, [filters.swimlane]);

  const onMoveStatus = React.useCallback(
    async (dealId: number, status: PipelineStatus) => {
      const deal = deals.find((d) => d.id === dealId);
      if (!deal || deal.pipelineStatus === status) return;
      await moveDealToStatus(dealId, status);
    },
    [deals, moveDealToStatus],
  );

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-4 font-medium text-neutral-12">{t('title')}</h2>
        <Button
          type="button"
          onClick={() => {
            setNewSwimlane('Sales');
            setNewOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" />
          {t('newDeal.create')}
        </Button>
      </div>

      <FilterBar
        spaceSlug={spaceSlug}
        filters={filters}
        onChange={setFilters}
        countryFocus={countryFocus}
        onExport={() =>
          exportDealsToXlsx(filtered, `${spaceSlug}-deals`, probabilities)
        }
        savedViewsSlot={
          <SavedViewsMenu
            spaceSlug={spaceSlug}
            filters={filters}
            onApply={setFilters}
          />
        }
      />

      <PipelineSummary deals={filtered} probabilities={probabilities} />

      {isLoading && deals.length === 0 ? (
        <div className="text-2 text-neutral-11">{t('loading')}</div>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleSwimlanes.map((swimlane) => {
            const laneDeals = filtered.filter(
              (d) => d.pipelineSwimlane === swimlane,
            );
            return (
              <section key={swimlane} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-3 font-medium text-neutral-12">
                    {swimlane}
                    <span className="ml-2 text-1 font-normal text-neutral-11">
                      ({laneDeals.length})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewSwimlane(swimlane);
                        setNewOpen(true);
                      }}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Link
                      href={getTrackHref(swimlane)}
                      className="text-1 text-accent-11 hover:underline"
                    >
                      {t('openTrack')}
                    </Link>
                  </div>
                </div>
                <KanbanBoard
                  deals={laneDeals}
                  onDealClick={(deal) => onDealOpen(deal.id)}
                  onMoveStatus={onMoveStatus}
                  activeDealId={activeDealId}
                  probabilities={probabilities}
                />
              </section>
            );
          })}
        </div>
      )}

      <NewDealDialog
        spaceSlug={spaceSlug}
        useMembers={useMembers}
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultSwimlane={newSwimlane}
        onCreated={onDealOpen}
      />
    </div>
  );
}
