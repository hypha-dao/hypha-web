'use client';

import * as React from 'react';
import { UsersIcon, ZapIcon } from 'lucide-react';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { ENERGY_PALETTE } from './charts';
import { SourceCard, SectionTitle } from './shared';
import { ConsumerConsumptionCard } from './consumer-consumption-card';
import { useEnergyPeople } from './use-energy-people';
import { prettySourceLabel } from './format';

export const EnergyOverviewTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const sources = data.sources ?? [];

  // address -> consumption meter ids, read from on-chain member records.
  const deviceIdsByAddress = React.useMemo(() => {
    const map = new Map<string, number[] | null>();
    (data.memberDetails ?? []).forEach((detail) => {
      map.set(detail.address.toLowerCase(), detail.deviceIds ?? null);
    });
    return map;
  }, [data.memberDetails]);

  // Actual consumers only: members without registered meters are investors
  // (they co-own sources but consume nothing), so they are excluded here.
  // Members whose meter list could not be read are kept (unknown ≠ investor).
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

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Local energy consumers"
          description="People taking part in this community's energy pool. Click a member to see their consumption."
          right={
            <span className="flex items-center gap-1.5 text-1 text-neutral-11">
              <UsersIcon size={14} />
              {consumers.length} consumer{consumers.length === 1 ? '' : 's'}
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
          <p className="text-2 text-neutral-11">No consumers registered yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Local energy sources"
          description="Generation and storage assets feeding the community."
          right={
            <span className="flex items-center gap-1.5 text-1 text-neutral-11">
              <ZapIcon size={14} />
              {sources.length} source{sources.length === 1 ? '' : 's'}
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
                )}
                type={source.sourceType}
                basePrice={source.basePricePerKwh}
                active={source.active}
                accent={ENERGY_PALETTE[index % ENERGY_PALETTE.length]!}
              />
            ))}
          </div>
        ) : (
          <p className="text-2 text-neutral-11">No sources registered yet.</p>
        )}
      </section>
    </div>
  );
};
