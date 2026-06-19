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
        'inline-flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-neutral-6 bg-neutral-2/95 p-1.5 shadow-sm backdrop-blur-sm',
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
        <TabsList triggerVariant="switch" className="h-8 shrink-0">
          <TabsTrigger
            variant="switch"
            value="globe"
            className="gap-1.5 px-2.5 text-xs sm:text-sm"
          >
            <Globe className="size-3.5 shrink-0" aria-hidden />
            {t('globeView')}
          </TabsTrigger>
          <TabsTrigger
            variant="switch"
            value="flat"
            className="gap-1.5 px-2.5 text-xs sm:text-sm"
          >
            <Map className="size-3.5 shrink-0" aria-hidden />
            {t('flatView')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Separator
        orientation="vertical"
        className="mx-0.5 h-6 shrink-0 self-center bg-neutral-7"
      />

      <div
        className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-neutral-3 p-0.5"
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
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all sm:text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-neutral-4/80 hover:text-foreground',
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
