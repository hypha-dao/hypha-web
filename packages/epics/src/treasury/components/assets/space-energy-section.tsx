'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from '@hypha-platform/ui';
import { formatUnits } from 'viem';
import { useSpaceEnergy } from '../../hooks/use-space-energy';

const ZERO = '0x0000000000000000000000000000000000000000';

const UNAVAILABLE = '—';

/** Stablecoin held by the PPA (e.g. USDC, 6 decimals). */
const formatStablecoinMicro = (value: string | null) => {
  if (value === null) return UNAVAILABLE;
  try {
    return Number(formatUnits(BigInt(value), 6)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  } catch {
    return value;
  }
};

/**
 * Internal settlement units on EnergyPPAv2 (integers; README: 1 unit ≈ 0.01 display currency
 * for interpretation alongside stablecoin scaling).
 */
const formatSignedInternal = (value: string | null) => {
  if (value === null) return UNAVAILABLE;
  try {
    const parsed = BigInt(value);
    const neg = parsed < 0n;
    const abs = neg ? -parsed : parsed;
    const formatted = abs.toLocaleString();
    return neg ? `−${formatted}` : formatted;
  } catch {
    return value;
  }
};

const formatBpsPct = (value: number | null) =>
  value === null ? UNAVAILABLE : `${(value / 100).toFixed(2)}%`;

const shortAddr = (a: string) =>
  a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

const roleOrDash = (a: string | null) =>
  !a || a.toLowerCase() === ZERO ? UNAVAILABLE : shortAddr(a);

export const SpaceEnergySection = () => {
  const { data, isLoading } = useSpaceEnergy();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!data?.enabled || !data.overview) {
    return null;
  }

  const act = data.activation;
  const roles = data.roles;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Energy overview</CardTitle>
            <CardDescription>
              Live settlement snapshot (internal credits, stablecoin pool, and
              accounting checks).
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
              <p className="text-neutral-11">Community fee</p>
              <p className="font-medium">
                {formatBpsPct(data.overview.communityFeeBps)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Aggregator fee</p>
              <p className="font-medium">
                {formatBpsPct(data.overview.aggregatorFeeBps)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Grid balance (internal)</p>
              <p className="font-medium">
                {formatSignedInternal(data.overview.gridBalance)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Settled balance (internal)</p>
              <p className="font-medium">
                {formatSignedInternal(data.overview.settledBalance)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Stablecoin in contract</p>
              <p className="font-medium">
                {formatStablecoinMicro(data.overview.contractStablecoinBalance)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Zero-sum</p>
              <p className="font-medium">
                {data.overview.zeroSumOk === null
                  ? UNAVAILABLE
                  : data.overview.zeroSumOk
                  ? 'Healthy'
                  : 'Mismatch'}{' '}
                <span className="text-1 text-neutral-11">
                  (Δ {formatSignedInternal(data.overview.zeroSumDelta)})
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract</CardTitle>
            <CardDescription>
              PPA proxy, energy token, and admin recorded for this space.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-2">
            {act ? (
              <>
                <div>
                  <p className="text-neutral-11">PPA proxy</p>
                  <p className="font-mono text-1 break-all">
                    {act.communityProxyAddress}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-11">Energy token</p>
                  <p className="font-mono text-1 break-all">
                    {act.energyTokenAddress}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-11">Admin</p>
                  <p className="font-mono text-1 break-all">
                    {act.adminAddress}
                  </p>
                </div>
                {act.factoryCommunityId != null ? (
                  <div>
                    <p className="text-neutral-11">Factory community id</p>
                    <p className="font-medium">{act.factoryCommunityId}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-neutral-11">Activated</p>
                  <p className="font-medium">
                    {new Date(act.activatedAt).toLocaleString()}
                  </p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {roles ? (
        <Card>
          <CardHeader>
            <CardTitle>Roles & export device</CardTitle>
            <CardDescription>
              Fee recipients and grid operator configured on-chain; export
              device id is used for surplus readings.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-2 sm:grid-cols-2">
            <div>
              <p className="text-neutral-11">Community</p>
              <p className="font-mono text-1">
                {roleOrDash(roles.communityAddress)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Aggregator</p>
              <p className="font-mono text-1">
                {roleOrDash(roles.aggregatorAddress)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Grid operator</p>
              <p className="font-mono text-1">
                {roleOrDash(roles.gridOperator)}
              </p>
            </div>
            <div>
              <p className="text-neutral-11">Export device id</p>
              <p className="font-medium">
                {roles.exportDeviceId ?? UNAVAILABLE}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.members && data.members.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Members (on-chain)</CardTitle>
            <CardDescription>
              Addresses registered on the energy contract for this community.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.members.map((m) => (
              <span
                key={m}
                className="rounded border border-border px-2 py-1 font-mono text-1"
                title={m}
              >
                {shortAddr(m)}
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Source mix</CardTitle>
          <CardDescription>
            Registered sources and reference base price per kWh (contract stores
            an integer; backend may apply dynamic pricing in readings).
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
                      {source.sourceType} ·{' '}
                      <span className="font-mono">
                        {shortAddr(source.ownershipToken)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-1 text-neutral-11">Base price / kWh</p>
                    <p className="font-medium">{source.basePricePerKwh}</p>
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
