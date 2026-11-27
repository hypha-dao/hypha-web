'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  SIGNAL_LANE_COLUMNS,
  SIGNAL_TAB_VIEWS,
  type SignalLaneColumns,
  type SignalTabView,
} from '../lib/signal-swimlanes';
import { FilterPill } from './signal-feed-filters';

const VIEW_LABEL_KEY = {
  feed: 'signalViewFeed',
  swimlanes: 'signalViewSwimlanes',
} as const satisfies Record<SignalTabView, string>;

const COLUMNS_LABEL_KEY = {
  none: 'signalLaneColumnsNone',
  type: 'signalLaneColumnsType',
  creator: 'signalLaneColumnsCreator',
} as const satisfies Record<SignalLaneColumns, string>;

type SignalViewSwitchProps = {
  view: SignalTabView;
  onViewChange: (view: SignalTabView) => void;
  columns: SignalLaneColumns;
  onColumnsChange: (columns: SignalLaneColumns) => void;
};

/** Feed / Swimlanes, and the swimlane column choice (#2765, #2763 D6). */
export function SignalViewSwitch({
  view,
  onViewChange,
  columns,
  onColumnsChange,
}: SignalViewSwitchProps) {
  const t = useTranslations('CoherenceTab');
  const viewOptions = React.useMemo(
    () =>
      SIGNAL_TAB_VIEWS.map((value) => ({
        value,
        label: t(VIEW_LABEL_KEY[value]),
      })),
    [t],
  );
  const columnOptions = React.useMemo(
    () =>
      SIGNAL_LANE_COLUMNS.map((value) => ({
        value,
        label: t(COLUMNS_LABEL_KEY[value]),
      })),
    [t],
  );

  return (
    <>
      {view === 'swimlanes' ? (
        <FilterPill
          label={`${t('signalLaneColumns')}: ${t(COLUMNS_LABEL_KEY[columns])}`}
          heading={t('signalLaneColumns')}
          value={columns}
          options={columnOptions}
          onChange={onColumnsChange}
          testId="signal-lane-columns-pill"
        />
      ) : null}
      <FilterPill
        label={t(VIEW_LABEL_KEY[view])}
        heading={t('signalView')}
        value={view}
        options={viewOptions}
        onChange={onViewChange}
        testId="signal-view-pill"
      />
    </>
  );
}
