'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import { UsersIcon, ZapIcon, CoinsIcon } from 'lucide-react';
import { useSpaceEnergy } from '../../hooks/use-space-energy';
import { StatCard } from './energy/shared';
import { ENERGY_PALETTE } from './energy/charts';
import { formatStablecoinMicro } from './energy/format';
import { EnergyOverviewTab } from './energy/overview-tab';
import { ProductionConsumptionTab } from './energy/production-consumption-tab';
import { OwnershipTab } from './energy/ownership-tab';
import { CreditsTab } from './energy/credits-tab';
import { useEnergyPeople } from './energy/use-energy-people';
import { usePreloadImages } from './energy/use-preload-images';

const TAB_VALUES = ['overview', 'flows', 'ownership', 'credits'] as const;

export const SpaceEnergySection = () => {
  const t = useTranslations('Energy.tabs');
  const tOverview = useTranslations('Energy.overview');
  const { data, isLoading } = useSpaceEnergy();
  const [tab, setTab] = React.useState<string>('overview');

  const memberAddresses = React.useMemo(
    () =>
      data?.enabled && data.members
        ? data.members.map((address) => address.toLowerCase())
        : [],
    [data?.enabled, data?.members],
  );

  const { people, isLoading: peopleLoading } = useEnergyPeople(memberAddresses);

  const avatarUrls = React.useMemo(() => {
    const urls = new Set<string>();
    for (const profile of Object.values(data?.participantProfiles ?? {})) {
      if (profile.avatarUrl) urls.add(profile.avatarUrl);
    }
    for (const person of Object.values(people)) {
      if (person?.avatarUrl) urls.add(person.avatarUrl);
    }
    return [...urls];
  }, [data?.participantProfiles, people]);

  usePreloadImages(avatarUrls);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!data?.enabled || !data.overview) {
    return null;
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
          value={consumerCount}
          accent={ENERGY_PALETTE[2]}
          icon={<UsersIcon size={16} />}
        />
        <StatCard
          label={tOverview('statSources')}
          value={overview.sourceCount}
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
            data={data}
            people={people}
            peopleLoading={peopleLoading}
          />
        </TabsContent>
        <TabsContent value="flows" className="mt-6">
          <ProductionConsumptionTab data={data} />
        </TabsContent>
        <TabsContent value="ownership" className="mt-6">
          <OwnershipTab
            data={data}
            people={people}
            peopleLoading={peopleLoading}
          />
        </TabsContent>
        <TabsContent value="credits" className="mt-6">
          <CreditsTab
            data={data}
            people={people}
            peopleLoading={peopleLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
