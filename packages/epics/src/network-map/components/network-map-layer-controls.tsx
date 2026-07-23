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
import {
  segmentedButtonClass,
  segmentedListClass,
  segmentedTriggerClass,
} from '../lib/segmented-control-styles';

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
        'flex w-full min-w-0 max-w-full flex-row flex-wrap items-center gap-2 sm:inline-flex sm:w-fit sm:gap-2.5',
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
        className="w-fit max-w-full"
      >
        <TabsList className={segmentedListClass} triggerVariant="switch">
          <TabsTrigger
            value="globe"
            variant="switch"
            className={segmentedTriggerClass}
          >
            <Globe className="size-3.5 shrink-0" aria-hidden />
            {t('globeView')}
          </TabsTrigger>
          <TabsTrigger
            value="flat"
            variant="switch"
            className={segmentedTriggerClass}
          >
            <Map className="size-3.5 shrink-0" aria-hidden />
            {t('flatView')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Separator
        orientation="vertical"
        className="mx-0.5 hidden h-6 shrink-0 self-center bg-border sm:block"
      />

      <div
        className="flex w-fit max-w-full min-w-0 items-center gap-1 rounded-lg bg-neutral-3 p-0.5"
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
              className={segmentedButtonClass(active)}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span>{t(`${layerId}Layer`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
