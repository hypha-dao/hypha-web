'use client';

import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Globe, Map } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { NetworkMapProjectionMode } from '../lib/types';
import {
  segmentedListClass,
  segmentedTriggerClass,
} from '../lib/segmented-control-styles';

type NetworkMapLayerControlsProps = {
  projectionMode: NetworkMapProjectionMode;
  onProjectionModeChange: (mode: NetworkMapProjectionMode) => void;
  className?: string;
};

export function NetworkMapLayerControls({
  projectionMode,
  onProjectionModeChange,
  className,
}: NetworkMapLayerControlsProps) {
  const t = useTranslations('NetworkMap');

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
    </div>
  );
}
