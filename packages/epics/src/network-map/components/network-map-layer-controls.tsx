'use client';

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  ChevronDown,
  Globe,
  Grid3x3,
  Layers,
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
  const activeLayerCount = LAYER_IDS.filter((id) => layers[id]).length;

  return (
    <div
      className={cn(
        'inline-flex w-fit max-w-full min-w-0 flex-row flex-wrap items-center gap-1.5',
        className,
      )}
      role="group"
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
            <Globe className="craft-icon-sm" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">{t('globeView')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="flat"
            variant="switch"
            className={segmentedTriggerClass}
          >
            <Map className="craft-icon-sm" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">{t('flatView')}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1 rounded-lg border-border/70 bg-neutral-3 px-2.5 text-xs font-medium text-neutral-11 shadow-none',
              'hover:bg-neutral-4 hover:text-foreground sm:text-sm',
            )}
            aria-label={t('layersLabel')}
          >
            <Layers className="craft-icon-sm" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">{t('layersLabel')}</span>
            <span className="tabular-nums text-muted-foreground">
              {activeLayerCount}
            </span>
            <ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto min-w-[11rem] rounded-lg border-border/70 p-2 shadow-md"
        >
          <div
            className="flex flex-col gap-1"
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
                    segmentedButtonClass(active),
                    'h-8 w-full justify-start px-2.5',
                  )}
                >
                  <Icon
                    className="craft-icon-sm"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span>{t(`${layerId}Layer`)}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
