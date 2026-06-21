'use client';

import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { LayoutList, Map } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  segmentedListClass,
  segmentedTriggerClass,
} from '../lib/segmented-control-styles';

export type NetworkMapView = 'list' | 'map';

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
        aria-label={t('viewToggleLabel')}
      >
        <TabsTrigger value="map" className={segmentedTriggerClass}>
          <Map className="size-3.5 shrink-0" aria-hidden />
          {t('mapView')}
        </TabsTrigger>
        <TabsTrigger value="list" className={segmentedTriggerClass}>
          <LayoutList className="size-3.5 shrink-0" aria-hidden />
          {t('listView')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
