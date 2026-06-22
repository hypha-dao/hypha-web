'use client';

import * as React from 'react';
import { UsersIcon, ZapIcon } from 'lucide-react';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { ENERGY_PALETTE } from './charts';
import { EnergyPersonCard, SourceCard, SectionTitle } from './shared';
import { useEnergyPeople } from './use-energy-people';
import { prettySourceLabel } from './format';

export const EnergyOverviewTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const members = data.members ?? [];
  const sources = data.sources ?? [];
  const { people, isLoading } = useEnergyPeople(members);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Local energy consumers"
          description="People taking part in this community's energy pool."
          right={
            <span className="flex items-center gap-1.5 text-1 text-neutral-11">
              <UsersIcon size={14} />
              {members.length} member{members.length === 1 ? '' : 's'}
            </span>
          }
        />
        {members.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {members.map((address) => (
              <EnergyPersonCard
                key={address}
                address={address}
                person={people[address.toLowerCase()]}
                isLoading={isLoading}
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
