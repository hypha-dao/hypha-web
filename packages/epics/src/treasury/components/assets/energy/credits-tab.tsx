'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { EnergyPersonCard } from './shared';
import { useEnergyPeople } from './use-energy-people';
import { ENERGY_PALETTE } from './charts';
import { formatStablecoinMicro } from './format';
import { dummySettledMicro } from './dummy-data';

type Row = {
  address: string;
  toSettleMicro: bigint;
  settledMicro: bigint;
};

const toBigInt = (value: string | null | undefined) => {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const SettleProgress = ({
  settled,
  toSettle,
}: {
  settled: bigint;
  toSettle: bigint;
}) => {
  const total = settled + toSettle;
  const pct = total > 0n ? Number((settled * 100n) / total) : 100;
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-4">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          backgroundColor: ENERGY_PALETTE[1],
        }}
      />
    </div>
  );
};

export const CreditsTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const details = data.memberDetails ?? [];

  const { rows, addresses } = React.useMemo(() => {
    const rows: Row[] = details.map((member) => ({
      address: member.address,
      toSettleMicro: toBigInt(member.debtInStablecoin),
      settledMicro: toBigInt(dummySettledMicro(member.address)),
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
  const totalSettled = rows.reduce((acc, r) => acc + r.settledMicro, 0n);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background-2 p-4">
          <p className="text-1 text-neutral-11">Outstanding to settle (USDC)</p>
          <p
            className="mt-1 text-5 font-semibold"
            style={{ color: ENERGY_PALETTE[4] }}
          >
            {formatStablecoinMicro(totalToSettle.toString())}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-2 p-4">
          <p className="text-1 text-neutral-11">Already settled (USDC)</p>
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
                  <div className="text-right">
                    <p
                      className="font-medium"
                      style={{ color: ENERGY_PALETTE[4] }}
                    >
                      {formatStablecoinMicro(row.toSettleMicro.toString())} to
                      settle
                    </p>
                    <p className="text-1 text-neutral-11">
                      {formatStablecoinMicro(row.settledMicro.toString())}{' '}
                      settled
                    </p>
                  </div>
                }
              />
              <SettleProgress
                settled={row.settledMicro}
                toSettle={row.toSettleMicro}
              />
            </div>
          ))}
          <p className="text-1 text-neutral-11">
            “Already settled” totals are placeholder figures pending the
            settlement indexer; “to settle” reflects live on-chain debt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
