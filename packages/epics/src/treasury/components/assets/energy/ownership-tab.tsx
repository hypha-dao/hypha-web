'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@hypha-platform/ui';
import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';
import { ENERGY_PALETTE } from './charts';
import { EnergyPersonCard } from './shared';
import { useEnergyPeople } from './use-energy-people';
import { formatBpsPct, sourceDisplayName } from './format';

type Owner = { address: string; bps: number };

export const OwnershipTab = ({ data }: { data: SpaceEnergyResponse }) => {
  const details = data.memberDetails ?? [];

  // sourceId -> { type, label } from the registered source list so we can show
  // friendly names (Solar / Battery) instead of the raw on-chain id.
  const sourceMeta = React.useMemo(() => {
    const map = new Map<string, { type: string; label: string }>();
    (data.sources ?? []).forEach((source) => {
      map.set(source.sourceId.toLowerCase(), {
        type: source.sourceType,
        label: source.sourceLabel,
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
    const groups = Array.from(map.entries())
      .filter(([, value]) => value.owners.length > 0)
      .map(([sourceId, value], index) => {
        const meta = sourceMeta.get(sourceId.toLowerCase());
        return {
          sourceId,
          name: sourceDisplayName(meta?.type, meta?.label, index),
          owners: value.owners.sort((a, b) => b.bps - a.bps),
        };
      });
    return { groups, allAddresses: Array.from(addresses) };
  }, [details, sourceMeta]);

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
                <CardTitle>{group.name}</CardTitle>
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
