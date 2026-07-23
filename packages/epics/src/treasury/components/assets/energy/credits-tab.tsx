'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import { EnergyPersonCard, GridOperatorCard } from './shared';
import { ENERGY_PALETTE } from './charts';
import {
  formatStablecoinMicro,
  resolveEnergyParticipantDisplay,
} from './format';
import type { EnergyTabProps } from './energy-tab-props';
import { energyAvatarLoading } from './energy-tab-props';

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

const internalToStablecoinMicro = (internal: bigint) => {
  const abs = internal < 0n ? -internal : internal;
  return abs * 10000n;
};

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

export const CreditsTab = ({ data, people, peopleLoading }: EnergyTabProps) => {
  const t = useTranslations('Energy.credits');
  const details = data.memberDetails ?? [];
  const participantProfiles = data.participantProfiles;
  const gridOperator = data.roles?.gridOperator ?? null;
  const gridBalanceInternal = toSignedBigInt(data.overview?.gridBalance);

  const rows = React.useMemo(() => {
    const rows: Row[] = details.map((member) => ({
      address: member.address,
      toSettleMicro: toBigInt(member.debtInStablecoin),
      creditMicro: toBigInt(member.creditInStablecoin),
    }));
    rows.sort(sortRows);
    return rows;
  }, [details]);

  const gridToSettleMicro =
    gridBalanceInternal > 0n
      ? internalToStablecoinMicro(gridBalanceInternal)
      : 0n;
  const gridReceivableMicro =
    gridBalanceInternal < 0n
      ? internalToStablecoinMicro(gridBalanceInternal)
      : 0n;

  if (!details.length && !gridOperator) {
    return <p className="text-2 text-neutral-11">{t('noBalances')}</p>;
  }

  const totalToSettle = rows.reduce((acc, r) => acc + r.toSettleMicro, 0n);
  const totalCredit = rows.reduce((acc, r) => acc + r.creditMicro, 0n);

  const eurcAmount = (micro: bigint) =>
    `${formatStablecoinMicro(micro.toString())} EURC`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="craft-card p-4">
          <p className="text-1 text-neutral-11">{t('outstandingToSettle')}</p>
          <p
            className="mt-1 text-5 font-semibold"
            style={{ color: ENERGY_PALETTE[4] }}
          >
            {formatStablecoinMicro(totalToSettle.toString())}
          </p>
        </div>
        <div className="craft-card p-4">
          <p className="text-1 text-neutral-11">{t('claimableCredit')}</p>
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
            <CardTitle>{t('gridOperator')}</CardTitle>
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
                      {t('toSettle', { amount: eurcAmount(gridToSettleMicro) })}
                    </p>
                  ) : null}
                  {gridReceivableMicro > 0n ? (
                    <p
                      className="font-medium"
                      style={{ color: ENERGY_PALETTE[1] }}
                    >
                      {t('receivable', {
                        amount: eurcAmount(gridReceivableMicro),
                      })}
                    </p>
                  ) : null}
                  {gridToSettleMicro === 0n && gridReceivableMicro === 0n ? (
                    <p className="font-medium text-neutral-11">
                      {t('balanced')}
                    </p>
                  ) : null}
                </div>
              }
            />
            <p className="text-1 text-neutral-11">{t('gridOperatorHint')}</p>
          </CardContent>
        </Card>
      ) : null}

      {rows.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('memberSettlement')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {rows.map((row) => {
              const display = resolveEnergyParticipantDisplay(
                row.address,
                people,
                participantProfiles,
              );
              return (
                <div key={row.address}>
                  <EnergyPersonCard
                    address={row.address}
                    person={people[row.address.toLowerCase()]}
                    displayName={display.displayName}
                    avatarUrl={display.avatarUrl}
                    subtitle={display.subtitle}
                    isLoading={energyAvatarLoading(
                      row.address,
                      peopleLoading,
                      participantProfiles,
                    )}
                    right={
                      <div className="text-right">
                        {row.toSettleMicro > 0n ? (
                          <p
                            className="font-medium"
                            style={{ color: ENERGY_PALETTE[4] }}
                          >
                            {t('toSettle', {
                              amount: eurcAmount(row.toSettleMicro),
                            })}
                          </p>
                        ) : null}
                        {row.creditMicro > 0n ? (
                          <p
                            className="font-medium"
                            style={{ color: ENERGY_PALETTE[1] }}
                          >
                            {t('receivable', {
                              amount: eurcAmount(row.creditMicro),
                            })}
                          </p>
                        ) : null}
                        {row.toSettleMicro === 0n && row.creditMicro === 0n ? (
                          <p className="font-medium text-neutral-11">
                            {t('zeroEurc')}
                          </p>
                        ) : null}
                      </div>
                    }
                  />
                </div>
              );
            })}
            <p className="text-1 text-neutral-11">{t('balancesHint')}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
