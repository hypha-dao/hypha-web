'use client';

import React from 'react';
import Link from 'next/link';
import {
  filterDeals,
  findTrackName,
  resolveDefaultTrackSlug,
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
import { Download, Plus } from 'lucide-react';
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
  const [newSwimlane, setNewSwimlane] = React.useState<PipelineSwimlane>('');
  const { deals, isLoading } = useDeals({ spaceSlug });
  const { moveDealToStatus } = useDealMutations(spaceSlug);
  const { countryFocus } = usePipelineSettings(spaceSlug);
  const { pageTitle, itemPlural, tracks, stages, probabilities } =
    usePipelineConfig(spaceSlug);
  const { collapsedLanes, toggleLane } = useCollapsedPipelineLanes(spaceSlug);
  const defaultTrack = resolveDefaultTrackSlug(tracks);

  const filtered = React.useMemo(
    () => filterDeals(deals, filters),
    [deals, filters],
  );

  const visibleTracks = React.useMemo(() => {
    if (!filters.swimlane) return tracks;
    const selected = Array.isArray(filters.swimlane)
      ? filters.swimlane
      : [filters.swimlane];
    return tracks.filter((track) => selected.includes(track.slug));
  }, [filters.swimlane, tracks]);

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
      <header className="craft-page-header">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <h1 className="craft-page-title text-6 font-medium">
            {pageTitle || t('title')}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void exportDealsToXlsx(
                  filtered,
                  `${spaceSlug}-deals`,
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
      </header>

      <FilterBar
        spaceSlug={spaceSlug}
        filters={filters}
        onChange={setFilters}
        useMembers={useMembers}
        countryFocus={countryFocus}
      />

      <PipelineSummary
        deals={filtered}
        tracks={tracks}
        stages={stages}
        probabilities={probabilities}
        itemPlural={itemPlural}
      />

      {isLoading && deals.length === 0 ? (
        <div className="text-2 text-neutral-11">
          {t('loading', { items: itemPlural })}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col">
          {visibleTracks.map((track) => {
            const laneDeals = filtered.filter(
              (d) => d.pipelineSwimlane === track.slug,
            );
            return (
              <PipelineLaneSection
                key={track.slug}
                laneSlug={track.slug}
                title={findTrackName(tracks, track.slug)}
                count={laneDeals.length}
                collapsed={collapsedLanes.includes(track.slug)}
                onToggle={() => toggleLane(track.slug)}
                actions={
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewSwimlane(track.slug);
                        setNewOpen(true);
                      }}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Link
                      href={getTrackHref(track.slug)}
                      className="text-1 whitespace-nowrap text-accent-11 hover:underline"
                    >
                      {t('openTrack')}
                    </Link>
                  </>
                }
              >
                <KanbanBoard
                  deals={laneDeals}
                  stages={stages}
                  onDealClick={(deal) => onDealOpen(deal.id)}
                  onMoveStatus={onMoveStatus}
                  activeDealId={activeDealId}
                  probabilities={probabilities}
                />
              </PipelineLaneSection>
            );
          })}
        </div>
      )}

      <DealCreateFab
        onClick={() => {
          setNewSwimlane(defaultTrack);
          setNewOpen(true);
        }}
      />
      <NewDealDialog
        spaceSlug={spaceSlug}
        useMembers={useMembers}
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultSwimlane={newSwimlane || defaultTrack}
      />
    </div>
  );
}
