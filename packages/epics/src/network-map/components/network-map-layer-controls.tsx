'use client';

import { Separator, Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  Globe,
  Grid3x3,
  LandPlot,
  Map,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  NETWORK_MAP_LAYER_IDS,
  type NetworkMapLayerId,
  type NetworkMapLayerVisibility,
  type NetworkMapProjectionMode,
} from '../lib/types';

type NetworkMapLayerControlsProps = {
  layers: NetworkMapLayerVisibility;
  projectionMode: NetworkMapProjectionMode;
  onLayerChange: (layer: NetworkMapLayerId, visible: boolean) => void;
  onProjectionModeChange: (mode: NetworkMapProjectionMode) => void;
  className?: string;
};

const LAYER_IDS = [...NETWORK_MAP_LAYER_IDS];

const LAYER_ICONS: Record<NetworkMapLayerId, LucideIcon> = {
  land: LandPlot,
  water: Waves,
  grid: Grid3x3,
};

export function NetworkMapLayerControls({
  layers,
  projectionMode,
  onLayerChange,
  onProjectionModeChange,
  className,
}: NetworkMapLayerControlsProps) {
  const t = useTranslations('NetworkMap');

  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full flex-col gap-2 sm:inline-flex sm:w-fit sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
      role="toolbar"
      aria-label={t('layerControlsLabel')}
    >
      <Tabs
        value={projectionMode}
        onValueChange={(value) =>
          onProjectionModeChange(value as NetworkMapProjectionMode)
        }
      >
        <TabsList className="h-8 w-full shrink-0 gap-0.5 bg-transparent p-0 sm:w-auto">
          <TabsTrigger
            value="globe"
            className="gap-1.5 rounded-md bg-transparent px-2.5 text-xs text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:text-sm"
          >
            <Globe className="size-3.5 shrink-0" aria-hidden />
            {t('globeView')}
          </TabsTrigger>
          <TabsTrigger
            value="flat"
            className="gap-1.5 rounded-md bg-transparent px-2.5 text-xs text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:text-sm"
          >
            <Map className="size-3.5 shrink-0" aria-hidden />
            {t('flatView')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Separator
        orientation="vertical"
        className="mx-0.5 hidden h-6 shrink-0 self-center bg-neutral-7 sm:block"
      />

      <div
        className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto"
        role="group"
        aria-label={t('layersLabel')}
      >
        {LAYER_IDS.map((layerId) => {
          const Icon = LAYER_ICONS[layerId];
          const active = layers[layerId];

          return (
            <button
              key={layerId}
              type="button"
              aria-pressed={active}
              onClick={() => onLayerChange(layerId, !active)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 shrink-0',
                  active ? 'text-accent-9' : 'text-neutral-9',
                )}
                aria-hidden
              />
              <span>{t(`${layerId}Layer`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
