'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { EnergyPersonCard } from './shared';
import { useEnergyPeople } from './use-energy-people';
import { formatSignedInternal } from './format';

type Holder = { address: string; balance: bigint };

export const CreditsTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const details = data.memberDetails ?? [];

  const { positive, negative, neutral, addresses } = React.useMemo(() => {
    const positive: Holder[] = [];
    const negative: Holder[] = [];
    const neutral: Holder[] = [];
    const addresses: string[] = [];
    for (const member of details) {
      addresses.push(member.address.toLowerCase());
      let balance = 0n;
      try {
        balance =
          member.energyCreditBalance !== null
            ? BigInt(member.energyCreditBalance)
            : 0n;
      } catch {
        balance = 0n;
      }
      const holder = { address: member.address, balance };
      if (balance > 0n) positive.push(holder);
      else if (balance < 0n) negative.push(holder);
      else neutral.push(holder);
    }
    positive.sort((a, b) => (b.balance > a.balance ? 1 : -1));
    negative.sort((a, b) => (a.balance > b.balance ? 1 : -1));
    return { positive, negative, neutral, addresses };
  }, [details]);

  const { people, isLoading } = useEnergyPeople(addresses);

  const renderHolder = (holder: Holder, accent: string) => (
    <EnergyPersonCard
      key={holder.address}
      address={holder.address}
      person={people[holder.address.toLowerCase()]}
      isLoading={isLoading}
      right={
        <span className="font-medium" style={{ color: accent }}>
          {formatSignedInternal(holder.balance.toString())}
        </span>
      }
    />
  );

  if (!details.length) {
    return (
      <p className="text-2 text-neutral-11">
        No member credit balances available yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-success-11">
            <TrendingUpIcon size={16} />
            <CardTitle>In credit</CardTitle>
            <span className="text-1 text-neutral-11">({positive.length})</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {positive.length ? (
            positive.map((h) => renderHolder(h, 'var(--success-11)'))
          ) : (
            <p className="text-2 text-neutral-11">No members in credit.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-error-9">
            <TrendingDownIcon size={16} />
            <CardTitle>In debt</CardTitle>
            <span className="text-1 text-neutral-11">({negative.length})</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {negative.length ? (
            negative.map((h) => renderHolder(h, 'var(--error-9)'))
          ) : (
            <p className="text-2 text-neutral-11">No members in debt.</p>
          )}
        </CardContent>
      </Card>

      {neutral.length ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Settled (zero balance)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {neutral.map((h) => renderHolder(h, 'var(--neutral-11)'))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
