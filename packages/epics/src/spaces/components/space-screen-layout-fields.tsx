'use client';

import {
  moveVisibleSpaceScreen,
  resolveSpaceScreenOrder,
  setSpaceScreenHidden,
  spaceScreenEditorKeys,
  type SpaceScreenLayout,
  type SpaceScreenLayoutKey,
} from '@hypha-platform/core/space/screen-layout';
import { Card, Switch } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

type SpaceScreenLayoutFieldsProps = {
  order?: readonly string[] | null;
  hidden?: readonly string[] | null;
  pipelineEnabled: boolean;
  showBanner?: boolean;
  energyEnabled: boolean;
  memoryEnabled: boolean;
  disabled?: boolean;
  onLayoutChange: (layout: SpaceScreenLayout) => void;
  onPipelineEnabledChange: (enabled: boolean) => void;
};

export function SpaceScreenLayoutFields({
  order,
  hidden,
  pipelineEnabled,
  showBanner = true,
  energyEnabled,
  memoryEnabled,
  disabled = false,
  onLayoutChange,
  onPipelineEnabledChange,
}: SpaceScreenLayoutFieldsProps) {
  const tSpaces = useTranslations('Spaces');
  const tCommon = useTranslations('Common');
  const tCoherence = useTranslations('CoherenceTab');

  const rows = spaceScreenEditorKeys({ order, energyEnabled, memoryEnabled });
  const hiddenSet = new Set(hidden ?? []);

  const labelFor = (key: SpaceScreenLayoutKey): string => {
    switch (key) {
      case 'overview':
        return tCommon('overview');
      case 'energy':
        return tCommon('Energy');
      case 'context':
        return tCommon('context');
      case 'coherence':
        return tCommon('Signals');
      case 'calendar':
        return tCommon('Calendar');
      case 'quests':
        return tCommon('quests');
      case 'pipeline':
        return tCommon('Pipeline');
      case 'agreements':
        return tCommon('Agreements');
      case 'treasury':
        return tCommon('Treasury');
      case 'members':
        return tCommon('Members');
      case 'memory':
        return tCoherence('spaceMemory');
      default:
        return key;
    }
  };

  const commitOrder = (nextOrder: SpaceScreenLayout['order']) => {
    onLayoutChange({
      order: nextOrder,
      hidden: setSpaceScreenHidden(hidden, 'overview', false),
      showBanner,
    });
  };

  return (
    <Card className="flex flex-col">
      <div className="flex flex-col gap-1 p-6 pb-4">
        <p className="text-2 font-medium">{tSpaces('screensTitle')}</p>
        <p className="text-1 text-neutral-11">
          {tSpaces('screensDescription')}
        </p>
      </div>
      <div className="flex items-center gap-3 border-t border-neutral-6 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-2 font-medium">
            {tSpaces('screenBannerTitle')}
          </span>
          <span className="text-1 text-neutral-11">
            {tSpaces('screenBannerDescription')}
          </span>
        </div>
        <Switch
          size="sm"
          checked={showBanner}
          disabled={disabled}
          aria-label={
            showBanner
              ? tSpaces('screenHide', { screen: tSpaces('screenBannerTitle') })
              : tSpaces('screenShow', { screen: tSpaces('screenBannerTitle') })
          }
          onCheckedChange={(next) => {
            onLayoutChange({
              order: resolveSpaceScreenOrder(order),
              hidden: setSpaceScreenHidden(hidden, 'overview', false),
              showBanner: next,
            });
          }}
        />
      </div>
      <ul aria-label={tSpaces('screensTitle')}>
        {rows.map((key, index) => {
          const label = labelFor(key);
          const isOverview = key === 'overview';
          const isPipeline = key === 'pipeline';
          const shown = isOverview || isPipeline || !hiddenSet.has(key);
          const checked = isPipeline ? pipelineEnabled : shown;
          return (
            <li
              key={key}
              className="flex items-center gap-3 border-t border-neutral-6 px-4 py-3"
            >
              <span className="w-6 shrink-0 text-right text-1 tabular-nums text-neutral-11">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    'text-2 font-medium',
                    !checked && 'text-neutral-11',
                  )}
                >
                  {label}
                </span>
                {isPipeline ? (
                  <span className="text-1 text-neutral-11">
                    {tSpaces('pipelineEnabledDescription')}
                  </span>
                ) : null}
                {isOverview ? (
                  <span className="text-1 text-neutral-11">
                    {tSpaces('screenOverviewAlwaysOn')}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 border border-border">
                <button
                  type="button"
                  className="flex size-5 items-center justify-center border-r border-border text-neutral-11 hover:bg-neutral-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                  aria-label={tSpaces('screenMoveUp', { screen: label })}
                  disabled={disabled || index === 0}
                  onClick={() =>
                    commitOrder(moveVisibleSpaceScreen(order, rows, key, -1))
                  }
                >
                  <ChevronUp className="size-3" strokeWidth={1.5} aria-hidden />
                </button>
                <button
                  type="button"
                  className="flex size-5 items-center justify-center text-neutral-11 hover:bg-neutral-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                  aria-label={tSpaces('screenMoveDown', { screen: label })}
                  disabled={disabled || index === rows.length - 1}
                  onClick={() =>
                    commitOrder(moveVisibleSpaceScreen(order, rows, key, 1))
                  }
                >
                  <ChevronDown
                    className="size-3"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </button>
              </div>
              <Switch
                size="sm"
                checked={checked}
                disabled={disabled || isOverview}
                aria-label={
                  isOverview
                    ? tSpaces('screenOverviewAlwaysOn')
                    : checked
                    ? tSpaces('screenHide', { screen: label })
                    : tSpaces('screenShow', { screen: label })
                }
                onCheckedChange={(next) => {
                  if (isPipeline) {
                    onPipelineEnabledChange(next);
                    return;
                  }
                  onLayoutChange({
                    order: resolveSpaceScreenOrder(order),
                    hidden: setSpaceScreenHidden(hidden, key, !next),
                    showBanner,
                  });
                }}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
