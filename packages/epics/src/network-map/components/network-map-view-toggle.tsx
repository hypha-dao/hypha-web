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
    <Tabs
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as NetworkMapView)}
      className={className}
    >
      <TabsList
        className="h-8 shrink-0 gap-0.5 bg-transparent p-0"
        aria-label={t('viewToggleLabel')}
      >
        <TabsTrigger
          value="map"
          className="gap-1.5 rounded-md bg-transparent px-2.5 text-xs text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:text-sm"
        >
          <Map className="size-3.5 shrink-0" aria-hidden />
          {t('mapView')}
        </TabsTrigger>
        <TabsTrigger
          value="list"
          className="gap-1.5 rounded-md bg-transparent px-2.5 text-xs text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:text-sm"
        >
          <LayoutList className="size-3.5 shrink-0" aria-hidden />
          {t('listView')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
