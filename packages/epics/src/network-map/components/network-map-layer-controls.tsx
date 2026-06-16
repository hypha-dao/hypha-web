'use client';

import { Switch, Label } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import type {
  NetworkMapLayerId,
  NetworkMapLayerVisibility,
  NetworkMapProjectionMode,
} from '../lib/types';

type NetworkMapLayerControlsProps = {
  layers: NetworkMapLayerVisibility;
  projectionMode: NetworkMapProjectionMode;
  onLayerChange: (layer: NetworkMapLayerId, visible: boolean) => void;
  onProjectionModeChange: (mode: NetworkMapProjectionMode) => void;
  className?: string;
};

const LAYER_IDS: NetworkMapLayerId[] = ['land', 'water', 'graticule'];

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
        'flex flex-wrap items-center gap-4 rounded-lg border border-neutral-6 bg-neutral-2/80 px-4 py-3 text-sm backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 transition-colors',
            projectionMode === 'globe'
              ? 'bg-accent-9 text-white'
              : 'text-neutral-11 hover:bg-neutral-4',
          )}
          onClick={() => onProjectionModeChange('globe')}
        >
          {t('globeView')}
        </button>
        <button
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 transition-colors',
            projectionMode === 'flat'
              ? 'bg-accent-9 text-white'
              : 'text-neutral-11 hover:bg-neutral-4',
          )}
          onClick={() => onProjectionModeChange('flat')}
        >
          {t('flatView')}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {LAYER_IDS.map((layerId) => (
          <div key={layerId} className="flex items-center gap-2">
            <Switch
              id={`network-map-layer-${layerId}`}
              checked={layers[layerId]}
              onCheckedChange={(checked) => onLayerChange(layerId, checked)}
            />
            <Label htmlFor={`network-map-layer-${layerId}`}>
              {t(`${layerId}Layer`)}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
