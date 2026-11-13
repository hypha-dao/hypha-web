'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { UsersIcon, ZapIcon, CoinsIcon } from 'lucide-react';
import { useSpaceEnergy } from '../../hooks/use-space-energy';
import { StatCard } from './energy/shared';
import { ENERGY_PALETTE } from './energy/energy-palette';
import { formatStablecoinMicro, UNAVAILABLE } from './energy/format';
import { EnergyOverviewTab } from './energy/overview-tab';
import { PRODUCTION_DEFAULT_TIMEFRAME } from './energy/energy-constants';
import { holdEnergySevenDaySettled } from '../../../common/energy-seven-day-settled';
import { useSpaceEnergyTelemetry } from '../../hooks/use-space-energy-telemetry';
import { useOverviewFirstTelemetryPrefetch } from '../../hooks/use-overview-first-telemetry-prefetch';
import { useEnergyPeople } from './energy/use-energy-people';
import {
  EnergyChartSkeleton,
  EnergySectionSkeleton,
} from './energy/loading-skeletons';

export { EnergySectionSkeleton };

const ProductionConsumptionTab = dynamic(
  () =>
    import('./energy/production-consumption-tab').then(
      (mod) => mod.ProductionConsumptionTab,
    ),
  {
    ssr: false,
    loading: () => <EnergyChartSkeleton height={220} bars={12} />,
  },
);

const OwnershipTab = dynamic(
  () => import('./energy/ownership-tab').then((mod) => mod.OwnershipTab),
  {
    ssr: false,
    loading: () => <EnergyChartSkeleton height={220} bars={12} />,
  },
);

const CreditsTab = dynamic(
  () => import('./energy/credits-tab').then((mod) => mod.CreditsTab),
  {
    ssr: false,
    loading: () => <EnergyChartSkeleton height={220} bars={12} />,
  },
);

const TAB_VALUES = ['overview', 'flows', 'ownership', 'credits'] as const;

export type SpaceEnergySectionProps = {
  /** Slug of the Space whose energy data is shown. */
  spaceSlug: string;
};

export const SpaceEnergySection = ({ spaceSlug }: SpaceEnergySectionProps) => {
  const t = useTranslations('Energy.tabs');
  const tOverview = useTranslations('Energy.overview');
  const { data, isLoading } = useSpaceEnergy(spaceSlug);
  const [tab, setTab] = React.useState<string>('overview');

  // Overview is gated only on `/energy`. 7d then 30d still prefetch so
  // Production opens from cache, but only after the consumer grid paints
  // (or as soon as the user leaves Overview).
  const prefetchEnabled = useOverviewFirstTelemetryPrefetch(
    Boolean(data?.enabled),
    tab,
  );
  const prefetchTelemetry = {
    enabled: prefetchEnabled,
    refreshInterval: 0,
  };
  const sevenDayTelemetry = useSpaceEnergyTelemetry(
    PRODUCTION_DEFAULT_TIMEFRAME,
    spaceSlug,
    prefetchTelemetry,
  );
  React.useEffect(() => {
    if (isLoading || data?.enabled) return;
    return holdEnergySevenDaySettled();
  }, [data?.enabled, isLoading]);
  useSpaceEnergyTelemetry('30d', spaceSlug, {
    ...prefetchTelemetry,
    enabled:
      prefetchTelemetry.enabled &&
      (sevenDayTelemetry.data !== undefined ||
        sevenDayTelemetry.retriesExhausted),
  });

  const memberAddresses = React.useMemo(
    () =>
      data?.enabled && data.members
        ? data.members.map((address) => address.toLowerCase())
        : [],
    [data?.enabled, data?.members],
  );

  const unresolvedMemberAddresses = React.useMemo(
    () =>
      memberAddresses.filter(
        (address) => !data?.participantProfiles?.[address]?.displayName,
      ),
    [data?.participantProfiles, memberAddresses],
  );

  const { people, isLoading: peopleLoading } = useEnergyPeople(
    unresolvedMemberAddresses,
  );

  if (!isLoading && (!data?.enabled || !data.overview)) {
    return null;
  }

  if (isLoading || !data?.overview) {
    return <EnergySectionSkeleton />;
  }

  const overview = data.overview;

  const totalSettledEurc = formatStablecoinMicro(
    overview.contractStablecoinBalance,
  );

  const memberDetails = data.memberDetails ?? [];
  const consumerCount = memberDetails.length
    ? memberDetails.filter(
        (detail) => detail.deviceIds === null || detail.deviceIds.length > 0,
      ).length
    : overview.memberCount;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={tOverview('statConsumers')}
          value={data.memberAddressesOk === false ? UNAVAILABLE : consumerCount}
          accent={ENERGY_PALETTE[2]}
          icon={<UsersIcon size={16} />}
        />
        <StatCard
          label={tOverview('statSources')}
          value={data.sourcesOk === false ? UNAVAILABLE : overview.sourceCount}
          accent={ENERGY_PALETTE[0]}
          icon={<ZapIcon size={16} />}
        />
        <StatCard
          label={tOverview('statTotalSettled')}
          value={totalSettledEurc}
          accent={ENERGY_PALETTE[1]}
          icon={<CoinsIcon size={16} />}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList triggerVariant="switch" className="flex w-full flex-wrap">
          {TAB_VALUES.map((value) => (
            <TabsTrigger key={value} value={value} variant="switch">
              {t(value)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <EnergyOverviewTab
            spaceSlug={spaceSlug}
            data={data}
            people={people}
            peopleLoading={peopleLoading}
          />
        </TabsContent>
        {tab === 'flows' ? (
          <TabsContent value="flows" className="mt-6">
            <ProductionConsumptionTab data={data} spaceSlug={spaceSlug} />
          </TabsContent>
        ) : null}
        {tab === 'ownership' ? (
          <TabsContent value="ownership" className="mt-6">
            <OwnershipTab
              spaceSlug={spaceSlug}
              data={data}
              people={people}
              peopleLoading={peopleLoading}
            />
          </TabsContent>
        ) : null}
        {tab === 'credits' ? (
          <TabsContent value="credits" className="mt-6">
            <CreditsTab
              spaceSlug={spaceSlug}
              data={data}
              people={people}
              peopleLoading={peopleLoading}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};
