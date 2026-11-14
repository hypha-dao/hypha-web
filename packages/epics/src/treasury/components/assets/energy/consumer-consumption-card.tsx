'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../../../people/components/person-avatar';
import { shortAddr } from './format';
import { EnergyChartSkeleton } from './loading-skeletons';

const ConsumerConsumptionChart = dynamic(
  () =>
    import('./consumer-consumption-chart').then(
      (mod) => mod.ConsumerConsumptionChart,
    ),
  {
    ssr: false,
    loading: () => <EnergyChartSkeleton height={200} bars={10} />,
  },
);

export const ConsumerConsumptionCard = ({
  spaceSlug,
  address,
  displayName,
  avatarUrl,
  personId,
  subtitle,
  isLoading,
  deviceIds,
  priority = false,
}: {
  spaceSlug: string;
  address: string;
  displayName: string;
  avatarUrl?: string;
  personId?: number;
  subtitle?: string;
  isLoading?: boolean;
  deviceIds: number[] | null;
  /** First-row portraits only — remaining cards lazy-load. */
  priority?: boolean;
}) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className={cn('craft-card', expanded && 'col-span-full')}>
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <PersonAvatar
          avatarSrc={avatarUrl}
          userName={displayName}
          size="md"
          shape="circle"
          isLoading={isLoading}
          personId={personId}
          priority={priority}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{displayName}</p>
          <p className="truncate text-1 text-neutral-11">
            {subtitle ?? shortAddr(address)}
          </p>
        </div>
        <ChevronDownIcon
          size={16}
          className={cn(
            'shrink-0 text-neutral-11 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <ConsumerConsumptionChart
          address={address}
          deviceIds={deviceIds}
          spaceSlug={spaceSlug}
        />
      ) : null}
    </div>
  );
};
