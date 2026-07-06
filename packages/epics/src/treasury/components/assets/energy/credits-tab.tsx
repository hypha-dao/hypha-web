'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { EnergyPersonCard, GridOperatorCard } from './shared';
import { useEnergyPeople } from './use-energy-people';
import { ENERGY_PALETTE } from './charts';
import { formatStablecoinMicro } from './format';

type Row = {
  address: string;
  toSettleMicro: bigint;
  creditMicro: bigint;
};

const toBigInt = (value: string | null | undefined) => {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const toSignedBigInt = (value: string | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

/** EnergyPPAv2 internal units → stablecoin micro-units (6 dp). */
const internalToStablecoinMicro = (internal: bigint) => {
  const abs = internal < 0n ? -internal : internal;
  return abs * 10000n;
};

const eurc = (micro: bigint) =>
  `${formatStablecoinMicro(micro.toString())} EURC`;

const sortRows = (a: Row, b: Row) => {
  const rank = (row: Row) =>
    row.toSettleMicro > 0n ? 2 : row.creditMicro > 0n ? 1 : 0;
  const rankDiff = rank(b) - rank(a);
  if (rankDiff !== 0) return rankDiff;

  const magnitude = (row: Row) =>
    row.toSettleMicro > 0n ? row.toSettleMicro : row.creditMicro;
  const aMag = magnitude(a);
  const bMag = magnitude(b);
  if (aMag > bMag) return -1;
  if (aMag < bMag) return 1;
  return 0;
};

export const CreditsTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const details = data.memberDetails ?? [];
  const gridOperator = data.roles?.gridOperator ?? null;
  const gridBalanceInternal = toSignedBigInt(data.overview?.gridBalance);

  const { rows, addresses } = React.useMemo(() => {
    const rows: Row[] = details.map((member) => ({
      address: member.address,
      toSettleMicro: toBigInt(member.debtInStablecoin),
      creditMicro: toBigInt(member.creditInStablecoin),
    }));
    rows.sort(sortRows);
    return {
      rows,
      addresses: details.map((m) => m.address.toLowerCase()),
    };
  }, [details]);

  const { people, isLoading } = useEnergyPeople(addresses);

  /** Community exported surplus → grid operator purchased it and owes settlement. */
  const gridToSettleMicro =
    gridBalanceInternal > 0n
      ? internalToStablecoinMicro(gridBalanceInternal)
      : 0n;
  /** Community net import → grid supplied energy and is owed payment. */
  const gridReceivableMicro =
    gridBalanceInternal < 0n
      ? internalToStablecoinMicro(gridBalanceInternal)
      : 0n;

  if (!details.length && !gridOperator) {
    return (
      <p className="text-2 text-neutral-11">
        No member settlement balances available yet.
      </p>
    );
  }

  const totalToSettle = rows.reduce((acc, r) => acc + r.toSettleMicro, 0n);
  const totalCredit = rows.reduce((acc, r) => acc + r.creditMicro, 0n);

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
          <p className="text-1 text-neutral-11">Claimable credit (EURC)</p>
          <p
            className="mt-1 text-5 font-semibold"
            style={{ color: ENERGY_PALETTE[1] }}
          >
            {formatStablecoinMicro(totalCredit.toString())}
          </p>
        </div>
      </div>

      {gridOperator ? (
        <Card>
          <CardHeader>
            <CardTitle>Grid operator</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <GridOperatorCard
              right={
                <div className="text-right">
                  {gridToSettleMicro > 0n ? (
                    <p
                      className="font-medium"
                      style={{ color: ENERGY_PALETTE[4] }}
                    >
                      {eurc(gridToSettleMicro)} to settle
                    </p>
                  ) : null}
                  {gridReceivableMicro > 0n ? (
                    <p
                      className="font-medium"
                      style={{ color: ENERGY_PALETTE[1] }}
                    >
                      {eurc(gridReceivableMicro)} receivable
                    </p>
                  ) : null}
                  {gridToSettleMicro === 0n && gridReceivableMicro === 0n ? (
                    <p className="font-medium text-neutral-11">Balanced</p>
                  ) : null}
                </div>
              }
            />
            <p className="text-1 text-neutral-11">
              When the community exports surplus energy, the grid operator buys
              it and must settle that amount. When the community imports from
              the grid, the operator is owed for the energy supplied.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {rows.length ? (
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
                      {row.toSettleMicro > 0n ? (
                        <p
                          className="font-medium"
                          style={{ color: ENERGY_PALETTE[4] }}
                        >
                          {eurc(row.toSettleMicro)} to settle
                        </p>
                      ) : null}
                      {row.creditMicro > 0n ? (
                        <p
                          className="font-medium"
                          style={{ color: ENERGY_PALETTE[1] }}
                        >
                          {eurc(row.creditMicro)} credit
                        </p>
                      ) : null}
                      {row.toSettleMicro === 0n && row.creditMicro === 0n ? (
                        <p className="font-medium text-neutral-11">0 EURC</p>
                      ) : null}
                    </div>
                  }
                />
              </div>
            ))}
            <p className="text-1 text-neutral-11">
              Balances reflect live on-chain energy credits from the PPA
              contract. “To settle” is outstanding debt; “credit” is claimable
              once EURC is deposited.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
