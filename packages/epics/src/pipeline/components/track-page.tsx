'use client';

import React from 'react';
import Link from 'next/link';
import {
  filterDeals,
  useDealMutations,
  useDeals,
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

type TrackPageProps = {
  spaceSlug: string;
  swimlane: PipelineSwimlane;
  boardHref: string;
  activeDealId?: number | null;
  onDealOpen: (dealId: number) => void;
};

export function TrackPage({
  spaceSlug,
  swimlane,
  boardHref,
  activeDealId,
  onDealOpen,
}: TrackPageProps) {
  const t = useTranslations('Pipeline');
  const [filters, setFilters] = React.useState<DealFilters>({ swimlane });
  const [newOpen, setNewOpen] = React.useState(false);
  const { deals, isLoading } = useDeals({ spaceSlug });
  const { moveDealToStatus } = useDealMutations(spaceSlug);

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
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={boardHref}
            className="text-1 text-accent-11 hover:underline"
          >
            ← {t('backToBoard')}
          </Link>
          <h2 className="text-4 font-medium text-neutral-12">
            {t('trackTitle', { swimlane })}
          </h2>
        </div>
        <Button type="button" onClick={() => setNewOpen(true)}>
          <Plus className="mr-1 size-4" />
          {t('newDeal.create')}
        </Button>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onExport={() =>
          exportDealsToXlsx(filtered, `${spaceSlug}-${swimlane}-deals`)
        }
        savedViewsSlot={
          <SavedViewsMenu
            spaceSlug={spaceSlug}
            filters={filters}
            onApply={setFilters}
          />
        }
      />

      <PipelineSummary deals={filtered} />

      {isLoading && deals.length === 0 ? (
        <div className="text-2 text-neutral-11">{t('loading')}</div>
      ) : (
        <KanbanBoard
          deals={filtered}
          onDealClick={(deal) => onDealOpen(deal.id)}
          onMoveStatus={onMoveStatus}
          activeDealId={activeDealId}
          wide
        />
      )}

      <NewDealDialog
        spaceSlug={spaceSlug}
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultSwimlane={swimlane}
        onCreated={onDealOpen}
      />
    </div>
  );
}
