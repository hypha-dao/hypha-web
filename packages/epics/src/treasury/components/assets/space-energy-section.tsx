'use client';

import * as React from 'react';
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
import { SettlementTab } from './energy/settlement-tab';
import { OwnershipTab } from './energy/ownership-tab';
import { CreditsTab } from './energy/credits-tab';

const TAB_DEFS = [
  { value: 'overview', label: 'Overview' },
  { value: 'flows', label: 'Production & consumption' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'ownership', label: 'Ownership' },
  { value: 'credits', label: 'Credits' },
] as const;

export const SpaceEnergySection = () => {
  const { data, isLoading } = useSpaceEnergy();
  const [tab, setTab] = React.useState<string>('overview');

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

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Energy consumers"
          value={overview.memberCount}
          accent={ENERGY_PALETTE[2]}
          icon={<UsersIcon size={16} />}
        />
        <StatCard
          label="Energy sources"
          value={overview.sourceCount}
          accent={ENERGY_PALETTE[0]}
          icon={<ZapIcon size={16} />}
        />
        <StatCard
          label="Total settled (USDC)"
          value={formatStablecoinMicro(overview.contractStablecoinBalance)}
          accent={ENERGY_PALETTE[1]}
          icon={<CoinsIcon size={16} />}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList triggerVariant="switch" className="flex w-full flex-wrap">
          {TAB_DEFS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} variant="switch">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <EnergyOverviewTab data={data} />
        </TabsContent>
        <TabsContent value="flows" className="mt-6">
          <ProductionConsumptionTab data={data} />
        </TabsContent>
        <TabsContent value="settlement" className="mt-6">
          <SettlementTab data={data} />
        </TabsContent>
        <TabsContent value="ownership" className="mt-6">
          <OwnershipTab data={data} />
        </TabsContent>
        <TabsContent value="credits" className="mt-6">
          <CreditsTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
