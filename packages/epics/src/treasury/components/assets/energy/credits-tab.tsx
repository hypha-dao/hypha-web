'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { EnergyPersonCard } from './shared';
import { useEnergyPeople } from './use-energy-people';
import { ENERGY_PALETTE } from './charts';
import { formatStablecoinMicro } from './format';

type Row = {
  address: string;
  toSettleMicro: bigint;
};

const toBigInt = (value: string | null | undefined) => {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const eurc = (micro: bigint) =>
  `${formatStablecoinMicro(micro.toString())} EURC`;

export const CreditsTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const details = data.memberDetails ?? [];

  const { rows, addresses } = React.useMemo(() => {
    const rows: Row[] = details.map((member) => ({
      address: member.address,
      toSettleMicro: toBigInt(member.debtInStablecoin),
    }));
    rows.sort((a, b) => (b.toSettleMicro > a.toSettleMicro ? 1 : -1));
    return { rows, addresses: details.map((m) => m.address.toLowerCase()) };
  }, [details]);

  const { people, isLoading } = useEnergyPeople(addresses);

  if (!details.length) {
    return (
      <p className="text-2 text-neutral-11">
        No member settlement balances available yet.
      </p>
    );
  }

  const totalToSettle = rows.reduce((acc, r) => acc + r.toSettleMicro, 0n);
  const totalSettled = toBigInt(data.overview?.contractStablecoinBalance);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background-2 p-4">
          <p className="text-1 text-neutral-11">Outstanding to settle (EURC)</p>
          <p
            className="mt-1 text-5 font-semibold"
            style={{ color: ENERGY_PALETTE[4] }}
          >
            {formatStablecoinMicro(totalToSettle.toString())}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-2 p-4">
          <p className="text-1 text-neutral-11">Already settled (EURC)</p>
          <p
            className="mt-1 text-5 font-semibold"
            style={{ color: ENERGY_PALETTE[1] }}
          >
            {formatStablecoinMicro(totalSettled.toString())}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member settlement</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.address}>
              <EnergyPersonCard
                address={row.address}
                person={people[row.address.toLowerCase()]}
                isLoading={isLoading}
                right={
                  <p
                    className="font-medium text-right"
                    style={{ color: ENERGY_PALETTE[4] }}
                  >
                    {eurc(row.toSettleMicro)} to settle
                  </p>
                }
              />
            </div>
          ))}
          <p className="text-1 text-neutral-11">
            “To settle” reflects live on-chain debt from the PPA contract.
            Per-member settled history is not shown yet; the “Already settled”
            total is EURC held by the contract.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
