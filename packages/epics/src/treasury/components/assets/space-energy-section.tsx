'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@hypha-platform/ui';
import { formatUnits } from 'viem';
import { useSpaceEnergy } from '../../hooks/use-space-energy';

const formatMicro = (value: string) => {
  try {
    return Number(formatUnits(BigInt(value), 6)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  } catch {
    return value;
  }
};

const formatSignedMicro = (value: string) => {
  try {
    const parsed = BigInt(value);
    const abs = parsed < 0n ? -parsed : parsed;
    const formatted = Number(formatUnits(abs, 6)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
    return parsed < 0n ? `-${formatted}` : formatted;
  } catch {
    return value;
  }
};

export const SpaceEnergySection = () => {
  const { data, isLoading } = useSpaceEnergy();

  if (isLoading || !data?.enabled || !data.overview) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Energy Overview</CardTitle>
          <CardDescription>
            Live settlement snapshot for this energy community.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-2">
          <div>
            <p className="text-neutral-11">Members</p>
            <p className="font-medium">{data.overview.memberCount}</p>
          </div>
          <div>
            <p className="text-neutral-11">Sources</p>
            <p className="font-medium">{data.overview.sourceCount}</p>
          </div>
          <div>
            <p className="text-neutral-11">Grid Balance</p>
            <p className="font-medium">
              {formatSignedMicro(data.overview.gridBalance)}
            </p>
          </div>
          <div>
            <p className="text-neutral-11">Settled Balance</p>
            <p className="font-medium">
              {formatSignedMicro(data.overview.settledBalance)}
            </p>
          </div>
          <div>
            <p className="text-neutral-11">Stablecoin Liquidity</p>
            <p className="font-medium">
              {formatMicro(data.overview.contractStablecoinBalance)}
            </p>
          </div>
          <div>
            <p className="text-neutral-11">Zero Sum</p>
            <p className="font-medium">
              {data.overview.zeroSumOk ? 'Healthy' : 'Mismatch'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source Mix</CardTitle>
          <CardDescription>
            Registered sources and base price configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.sources?.length ? (
            data.sources.map((source, index) => (
              <div key={source.sourceId} className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{source.sourceLabel}</p>
                    <p className="text-1 text-neutral-11">
                      {source.sourceType} · {source.ownershipToken}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-1 text-neutral-11">Base price / kWh</p>
                    <p className="font-medium">
                      {formatMicro(source.basePricePerKwh)}
                    </p>
                    <p className="text-1 text-neutral-11">
                      {source.active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
                {index < (data.sources?.length ?? 0) - 1 ? <Separator /> : null}
              </div>
            ))
          ) : (
            <p className="text-2 text-neutral-11">No sources registered yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
