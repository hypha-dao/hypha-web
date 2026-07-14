'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { UsersIcon, ZapIcon } from 'lucide-react';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { ENERGY_PALETTE } from './charts';
import { SourceCard, SectionTitle } from './shared';
import { ConsumerConsumptionCard } from './consumer-consumption-card';
import { useEnergyPeople } from './use-energy-people';
import { prettySourceLabel } from './format';

export const EnergyOverviewTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const t = useTranslations('Energy.overview');
  const tShared = useTranslations('Energy.shared');
  const sources = data.sources ?? [];

  const deviceIdsByAddress = React.useMemo(() => {
    const map = new Map<string, number[] | null>();
    (data.memberDetails ?? []).forEach((detail) => {
      map.set(detail.address.toLowerCase(), detail.deviceIds ?? null);
    });
    return map;
  }, [data.memberDetails]);

  const consumers = React.useMemo(
    () =>
      (data.members ?? []).filter((address) => {
        const deviceIds = deviceIdsByAddress.get(address.toLowerCase());
        return deviceIds === undefined || deviceIds === null
          ? true
          : deviceIds.length > 0;
      }),
    [data.members, deviceIdsByAddress],
  );

  const { people, isLoading } = useEnergyPeople(consumers);
  const sourceFallback = tShared('source');
  const sourceTypeLabels = {
    SOLAR: tShared('sourceTypeSolar'),
    BATTERY: tShared('sourceTypeBattery'),
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionTitle
          title={t('consumersTitle')}
          description={t('consumersDescription')}
          right={
            <span className="flex items-center gap-1.5 text-1 text-neutral-11">
              <UsersIcon size={14} />
              {t('consumerCount', { count: consumers.length })}
            </span>
          }
        />
        {consumers.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {consumers.map((address) => (
              <ConsumerConsumptionCard
                key={address}
                address={address}
                person={people[address.toLowerCase()]}
                isLoading={isLoading}
                deviceIds={
                  deviceIdsByAddress.get(address.toLowerCase()) ?? null
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-2 text-neutral-11">{t('noConsumers')}</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle
          title={t('sourcesTitle')}
          description={t('sourcesDescription')}
          right={
            <span className="flex items-center gap-1.5 text-1 text-neutral-11">
              <ZapIcon size={14} />
              {t('sourceCount', { count: sources.length })}
            </span>
          }
        />
        {sources.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((source, index) => (
              <SourceCard
                key={source.sourceId}
                label={prettySourceLabel(
                  source.sourceLabel,
                  index,
                  source.sourceType,
                  sourceFallback,
                  sourceTypeLabels,
                )}
                type={source.sourceType}
                basePrice={source.basePricePerKwh}
                active={source.active}
                accent={ENERGY_PALETTE[index % ENERGY_PALETTE.length]!}
              />
            ))}
          </div>
        ) : (
          <p className="text-2 text-neutral-11">{t('noSources')}</p>
        )}
      </section>
    </div>
  );
};
