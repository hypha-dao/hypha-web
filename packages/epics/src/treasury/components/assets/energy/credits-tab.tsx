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

  const { rows, addresses, gridOperatorAddresses } = React.useMemo(() => {
    const rows: Row[] = details.map((member) => ({
      address: member.address,
      toSettleMicro: toBigInt(member.debtInStablecoin),
      creditMicro: toBigInt(member.creditInStablecoin),
    }));
    rows.sort(sortRows);
    const memberAddresses = details.map((m) => m.address.toLowerCase());
    const gridOperatorAddresses = gridOperator
      ? [
          gridOperator.toLowerCase(),
          ...memberAddresses.filter((a) => a !== gridOperator.toLowerCase()),
        ]
      : memberAddresses;
    return {
      rows,
      addresses: memberAddresses,
      gridOperatorAddresses,
    };
  }, [details, gridOperator]);

  const { people, isLoading } = useEnergyPeople(gridOperatorAddresses);

  const gridOperatorMember = React.useMemo(() => {
    if (!gridOperator) return null;
    return details.find(
      (member) => member.address.toLowerCase() === gridOperator.toLowerCase(),
    );
  }, [details, gridOperator]);

  const gridOperatorPersonalCredit = toBigInt(
    gridOperatorMember?.creditInStablecoin,
  );
  const gridCreditMicro =
    gridBalanceInternal > 0n
      ? internalToStablecoinMicro(gridBalanceInternal)
      : 0n;
  const gridDebtMicro =
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
  const totalSettled = toBigInt(data.overview?.contractStablecoinBalance);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <div className="rounded-xl border border-border bg-background-2 p-4">
          <p className="text-1 text-neutral-11">EURC in contract</p>
          <p
            className="mt-1 text-5 font-semibold"
            style={{ color: ENERGY_PALETTE[1] }}
          >
            {formatStablecoinMicro(totalSettled.toString())}
          </p>
        </div>
      </div>

      {gridOperator ? (
        <Card>
          <CardHeader>
            <CardTitle>Grid operator</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <EnergyPersonCard
              address={gridOperator}
              person={people[gridOperator.toLowerCase()]}
              isLoading={isLoading}
              right={
                <div className="text-right">
                  {gridCreditMicro > 0n ? (
                    <p
                      className="font-medium"
                      style={{ color: ENERGY_PALETTE[1] }}
                    >
                      {eurc(gridCreditMicro)} grid credit
                    </p>
                  ) : null}
                  {gridDebtMicro > 0n ? (
                    <p
                      className="font-medium"
                      style={{ color: ENERGY_PALETTE[4] }}
                    >
                      {eurc(gridDebtMicro)} grid debt
                    </p>
                  ) : null}
                  {gridCreditMicro === 0n && gridDebtMicro === 0n ? (
                    <p className="font-medium text-neutral-11">Balanced grid</p>
                  ) : null}
                  {gridOperatorPersonalCredit > 0n ? (
                    <p className="text-1 text-neutral-11">
                      {eurc(gridOperatorPersonalCredit)} personal credit
                    </p>
                  ) : null}
                </div>
              }
            />
            <p className="text-1 text-neutral-11">
              Grid credit means the community exported more energy than it
              imported; grid debt means the opposite. Only the grid operator can
              claim grid credit or arrange grid debt settlement on-chain.
              {gridOperatorPersonalCredit > 0n
                ? ' Personal credit is separate revenue the operator earned as a community member or source owner.'
                : null}
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
              once EURC is deposited. “EURC in contract” is stablecoin held by
              the PPA today.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
