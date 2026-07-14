'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDownIcon } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../../../people/components/person-avatar';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { useSpaceEnergyTelemetry } from '../../../hooks/use-space-energy-telemetry';
import { BarChart, ENERGY_PALETTE, type ChartSeries } from './charts';
import { useEnergyPeople, type EnergyPerson } from './use-energy-people';
import {
  formatBpsPct,
  personDisplayName,
  shortAddr,
  sourceDisplayName,
} from './format';
import {
  buildSourceProductionSeries,
  granularityConfig,
  granularityLabels,
  type Granularity,
} from './granularity';
import { GranularityToggle } from './granularity-toggle';

type Owner = { address: string; bps: number };

type SourceGroup = {
  sourceId: string;
  name: string;
  /** Index of this source in the registered source list (`data.sources`). */
  sourceIndex: number;
  /** On-chain internal price units: value / 100 = stablecoin per kWh. */
  basePricePerKwh: number;
  owners: Owner[];
};

/**
 * Production series for one source under a daily/weekly/monthly granularity.
 * Live interval telemetry when available; deterministic placeholder otherwise.
 * Production meters are reported sorted by meter id, which matches the order
 * sources are registered on-chain (9001 -> first source, 9002 -> second, …).
 */
const useSourceProduction = (
  sourceIndex: number,
  sourceName: string,
  granularity: Granularity,
  locale: string,
) => {
  const cfg = granularityConfig(granularity);
  const {
    data: telemetry,
    isLoading,
    error,
  } = useSpaceEnergyTelemetry(cfg.period);

  const live = Boolean(
    telemetry?.enabled && telemetry.configured && !error && telemetry.dataFrom,
  );

  return React.useMemo(() => {
    const liveSeries = live
      ? telemetry!.productionBySource[sourceIndex]
      : undefined;
    if (liveSeries) {
      return {
        labels: telemetry!.labels,
        values: liveSeries.valuesKwh,
        isPlaceholder: false,
        isLoading,
      };
    }
    return {
      labels: granularityLabels(granularity, locale),
      values: buildSourceProductionSeries(sourceName, granularity),
      isPlaceholder: true,
      isLoading,
    };
  }, [
    live,
    telemetry,
    sourceIndex,
    sourceName,
    granularity,
    isLoading,
    locale,
  ]);
};

const earningsFromProduction = (
  productionKwh: number[],
  basePricePerKwh: number,
  bps: number,
) => productionKwh.map((kwh) => kwh * (basePricePerKwh / 100) * (bps / 10_000));

const formatEarnings = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const OwnerEarningsChart = ({
  group,
  owner,
  accent,
}: {
  group: SourceGroup;
  owner: Owner;
  accent: string;
}) => {
  const locale = useLocale();
  const t = useTranslations('Energy.ownership');
  const [granularity, setGranularity] = React.useState<Granularity>('daily');
  const production = useSourceProduction(
    group.sourceIndex,
    group.name,
    granularity,
    locale,
  );

  const earnings = earningsFromProduction(
    production.values,
    group.basePricePerKwh,
    owner.bps,
  );
  const total = earnings.reduce((a, b) => a + b, 0);

  const series: ChartSeries[] = [
    {
      key: 'earnings',
      label: t('earnings'),
      color: accent,
      values: earnings.map((v) => Math.round(v * 100) / 100),
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-1 text-neutral-11">
          {t('earningsOverWindow', { amount: formatEarnings(total) })}
        </p>
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>
      {production.isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <BarChart
          series={series}
          labels={production.labels}
          mode="grouped"
          height={200}
          valueSuffix={t('eurcSuffix')}
          valueDecimals={2}
          showLegend={false}
        />
      )}
      <p className="text-1 text-neutral-11">
        {production.isPlaceholder
          ? t('placeholderEstimate')
          : t('liveEstimate')}
      </p>
    </div>
  );
};

const OwnerEarningsRow = ({
  group,
  owner,
  person,
  isLoading,
  accent,
  totalEarned,
  totalIsPlaceholder,
}: {
  group: SourceGroup;
  owner: Owner;
  person?: EnergyPerson | null;
  isLoading?: boolean;
  accent: string;
  totalEarned: number;
  totalIsPlaceholder: boolean;
}) => {
  const t = useTranslations('Energy.ownership');
  const [expanded, setExpanded] = React.useState(false);
  const name = personDisplayName(person) ?? shortAddr(owner.address);

  return (
    <div className="rounded-xl border border-border bg-background-2">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <PersonAvatar
          avatarSrc={person?.avatarUrl ?? undefined}
          userName={personDisplayName(person) ?? undefined}
          size="md"
          shape="circle"
          isLoading={isLoading}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{name}</p>
          <p className="truncate text-1 text-neutral-11">
            {t('earnedFromSource', {
              prefix: totalIsPlaceholder ? '≈ ' : '',
              amount: formatEarnings(totalEarned),
            })}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-1 text-1 font-medium"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {formatBpsPct(owner.bps)}
        </span>
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
        <OwnerEarningsChart group={group} owner={owner} accent={accent} />
      ) : null}
    </div>
  );
};

const SourceOwnershipCard = ({
  group,
  accent,
  people,
  peopleLoading,
}: {
  group: SourceGroup;
  accent: string;
  people: Record<string, EnergyPerson | null>;
  peopleLoading: boolean;
}) => {
  const locale = useLocale();
  const t = useTranslations('Energy.ownership');
  const tShared = useTranslations('Energy.shared');
  const production = useSourceProduction(
    group.sourceIndex,
    group.name,
    'monthly',
    locale,
  );
  const totalProductionKwh = production.values.reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <CardTitle>{group.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {group.owners.map((owner) => (
          <OwnerEarningsRow
            key={`${group.sourceId}-${owner.address}`}
            group={group}
            owner={owner}
            person={people[owner.address.toLowerCase()]}
            isLoading={peopleLoading}
            accent={accent}
            totalEarned={
              totalProductionKwh *
              (group.basePricePerKwh / 100) *
              (owner.bps / 10_000)
            }
            totalIsPlaceholder={production.isPlaceholder}
          />
        ))}
        <p className="text-1 text-neutral-11">
          {t('earningsHint', {
            dataType: production.isPlaceholder ? t('placeholder') : t('live'),
          })}
        </p>
      </CardContent>
    </Card>
  );
};

export const OwnershipTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const t = useTranslations('Energy.ownership');
  const tShared = useTranslations('Energy.shared');
  const details = data.memberDetails ?? [];

  // sourceId -> { type, label, index, price } from the registered source list
  // so we can show friendly names (Solar / Battery) instead of the raw
  // on-chain id and derive earnings from the source base price.
  const sourceMeta = React.useMemo(() => {
    const map = new Map<
      string,
      { type: string; label: string; index: number; basePricePerKwh: number }
    >();
    (data.sources ?? []).forEach((source, index) => {
      map.set(source.sourceId.toLowerCase(), {
        type: source.sourceType,
        label: source.sourceLabel,
        index,
        basePricePerKwh: Number(source.basePricePerKwh) || 0,
      });
    });
    return map;
  }, [data.sources]);

  const { groups, allAddresses } = React.useMemo(() => {
    const map = new Map<string, { owners: Owner[] }>();
    const addresses = new Set<string>();
    for (const member of details) {
      for (const ownership of member.ownerships) {
        // Hide members with no active share in the source.
        if (ownership.ownershipBps <= 0) continue;
        const existing = map.get(ownership.sourceId) ?? { owners: [] };
        existing.owners.push({
          address: member.address,
          bps: ownership.ownershipBps,
        });
        map.set(ownership.sourceId, existing);
        addresses.add(member.address.toLowerCase());
      }
    }
    const groups: SourceGroup[] = Array.from(map.entries())
      .filter(([, value]) => value.owners.length > 0)
      .map(([sourceId, value], index) => {
        const meta = sourceMeta.get(sourceId.toLowerCase());
        return {
          sourceId,
          name: sourceDisplayName(
            meta?.type,
            meta?.label,
            index,
            tShared('source'),
            {
              SOLAR: tShared('sourceTypeSolar'),
              BATTERY: tShared('sourceTypeBattery'),
            },
          ),
          sourceIndex: meta?.index ?? index,
          basePricePerKwh: meta?.basePricePerKwh ?? 0,
          owners: value.owners.sort((a, b) => b.bps - a.bps),
        };
      });
    return { groups, allAddresses: Array.from(addresses) };
  }, [details, sourceMeta, tShared]);

  const { people, isLoading } = useEnergyPeople(allAddresses);

  if (!groups.length) {
    return <p className="text-2 text-neutral-11">{t('noOwnership')}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group, index) => (
        <SourceOwnershipCard
          key={group.sourceId}
          group={group}
          accent={ENERGY_PALETTE[index % ENERGY_PALETTE.length]!}
          people={people}
          peopleLoading={isLoading}
        />
      ))}
    </div>
  );
};
