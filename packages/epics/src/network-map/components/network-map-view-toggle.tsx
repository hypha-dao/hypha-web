'use client';

import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { LayoutList, Map } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  segmentedListClass,
  segmentedTriggerClass,
} from '../lib/segmented-control-styles';

export type NetworkMapView = 'overview' | 'list' | 'map';

/** Map rectangle sitting above list rules — not a panels glyph. */
function MapOverListIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" className={className} fill="none" aria-hidden>
      <rect
        x="1"
        y="1"
        width="12"
        height="6.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path d="M1 10.25h12M1 12.5h8" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

type NetworkMapViewToggleProps = {
  value: NetworkMapView;
  onChange: (view: NetworkMapView) => void;
  className?: string;
};

export function NetworkMapViewToggle({
  value,
  onChange,
  className,
}: NetworkMapViewToggleProps) {
  const t = useTranslations('NetworkMap');

  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as NetworkMapView)}
      className={cn('w-fit max-w-full', className)}
    >
      <TabsList
        className={segmentedListClass}
        triggerVariant="switch"
        aria-label={t('viewToggleLabel')}
      >
        <TabsTrigger
          value="overview"
          variant="switch"
          className={segmentedTriggerClass}
        >
          <MapOverListIcon className="size-3.5 shrink-0" />
          {t('overviewView')}
        </TabsTrigger>
        <TabsTrigger
          value="list"
          variant="switch"
          className={segmentedTriggerClass}
        >
          <LayoutList className="size-3.5 shrink-0" aria-hidden />
          {t('listView')}
        </TabsTrigger>
        <TabsTrigger
          value="map"
          variant="switch"
          className={segmentedTriggerClass}
        >
          <Map className="size-3.5 shrink-0" aria-hidden />
          {t('mapView')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
