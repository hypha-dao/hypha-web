'use client';

import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { LayoutList, Map } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
    <div
      className={cn(
        'inline-flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-neutral-6 bg-neutral-2/95 p-1.5 shadow-sm backdrop-blur-sm',
        className,
      )}
      role="group"
      aria-label={t('viewToggleLabel')}
    >
      <Tabs
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as NetworkMapView)}
      >
        <TabsList triggerVariant="switch" className="h-8 shrink-0">
          <TabsTrigger
            variant="switch"
            value="map"
            className="gap-1.5 px-2.5 text-xs sm:text-sm"
          >
            <Map className="size-3.5 shrink-0" aria-hidden />
            {t('mapView')}
          </TabsTrigger>
          <TabsTrigger
            variant="switch"
            value="list"
            className="gap-1.5 px-2.5 text-xs sm:text-sm"
          >
            <LayoutList className="size-3.5 shrink-0" aria-hidden />
            {t('listView')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
