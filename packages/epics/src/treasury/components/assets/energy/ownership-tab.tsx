'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { ENERGY_PALETTE } from './charts';
import { EnergyPersonCard } from './shared';
import { useEnergyPeople } from './use-energy-people';
import { formatBpsPct, prettySourceLabel } from './format';

type Owner = { address: string; bps: number };

export const OwnershipTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const details = data.memberDetails ?? [];

  const { groups, allAddresses } = React.useMemo(() => {
    const map = new Map<string, { label: string; owners: Owner[] }>();
    const addresses = new Set<string>();
    for (const member of details) {
      for (const ownership of member.ownerships) {
        const existing = map.get(ownership.sourceId) ?? {
          label: ownership.sourceLabel,
          owners: [],
        };
        existing.owners.push({
          address: member.address,
          bps: ownership.ownershipBps,
        });
        map.set(ownership.sourceId, existing);
        addresses.add(member.address.toLowerCase());
      }
    }
    const groups = Array.from(map.entries()).map(([sourceId, value]) => ({
      sourceId,
      label: value.label,
      owners: value.owners.sort((a, b) => b.bps - a.bps),
    }));
    return { groups, allAddresses: Array.from(addresses) };
  }, [details]);

  const { people, isLoading } = useEnergyPeople(allAddresses);

  if (!groups.length) {
    return (
      <p className="text-2 text-neutral-11">
        No source ownership has been recorded on-chain yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group, index) => {
        const accent = ENERGY_PALETTE[index % ENERGY_PALETTE.length]!;
        return (
          <Card key={group.sourceId}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <CardTitle>{prettySourceLabel(group.label, index)}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {group.owners.map((owner) => (
                <EnergyPersonCard
                  key={`${group.sourceId}-${owner.address}`}
                  address={owner.address}
                  person={people[owner.address.toLowerCase()]}
                  isLoading={isLoading}
                  right={
                    <span
                      className="rounded-full px-2 py-1 text-1 font-medium"
                      style={{ backgroundColor: `${accent}22`, color: accent }}
                    >
                      {formatBpsPct(owner.bps)}
                    </span>
                  }
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
