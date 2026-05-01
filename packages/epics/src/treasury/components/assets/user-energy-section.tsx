'use client';

import React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import { formatUnits } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { energyPpaV2Abi, publicClient } from '@hypha-platform/core/client';
import { useUserEnergy } from '../../hooks/use-user-energy';

const formatMicro = (value: string) => {
  try {
    return Number(formatUnits(BigInt(value), 6)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  } catch {
    return value;
  }
};

const formatBps = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `${(parsed / 100).toFixed(2)}%`;
};

export const UserEnergySection = ({
  personSlug,
  isMyProfile,
}: {
  personSlug: string;
  isMyProfile?: boolean;
}) => {
  const { data, isLoading, refresh } = useUserEnergy(personSlug);
  const { client } = useSmartWallets();
  const [isClaimingByProxy, setIsClaimingByProxy] = React.useState<
    Record<string, boolean>
  >({});
  const [isSettlingByProxy, setIsSettlingByProxy] = React.useState<
    Record<string, boolean>
  >({});

  const handleClaim = async (
    communityProxyAddress: `0x${string}`,
    amount: string,
  ) => {
    if (!client) {
      throw new Error('Smart wallet is not connected.');
    }
    const internalAmount = BigInt(amount);
    if (internalAmount <= 0n) return;

    setIsClaimingByProxy((prev) => ({
      ...prev,
      [communityProxyAddress]: true,
    }));
    try {
      const hash = await client.writeContract({
        address: communityProxyAddress,
        abi: energyPpaV2Abi,
        functionName: 'claimCredit',
        args: [internalAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } finally {
      setIsClaimingByProxy((prev) => ({
        ...prev,
        [communityProxyAddress]: false,
      }));
    }
  };

  const handleSettle = async (
    communityProxyAddress: `0x${string}`,
    stablecoinAmount: string,
  ) => {
    if (!client) {
      throw new Error('Smart wallet is not connected.');
    }
    const amount = BigInt(stablecoinAmount);
    if (amount <= 0n) return;

    setIsSettlingByProxy((prev) => ({
      ...prev,
      [communityProxyAddress]: true,
    }));
    try {
      const hash = await client.writeContract({
        address: communityProxyAddress,
        abi: energyPpaV2Abi,
        functionName: 'settleOwnDebt',
        args: [amount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } finally {
      setIsSettlingByProxy((prev) => ({
        ...prev,
        [communityProxyAddress]: false,
      }));
    }
  };

  if (isLoading || !data?.enabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Energy</CardTitle>
        <CardDescription>
          Consumption settlement balances and ownership across active energy
          communities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.totals ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-1 text-neutral-11">Energy Credit</p>
              <p className="font-medium">
                {formatMicro(data.totals.energyCreditBalance)}
              </p>
            </div>
            <div>
              <p className="text-1 text-neutral-11">Debt (stablecoin)</p>
              <p className="font-medium">
                {formatMicro(data.totals.debtInStablecoin)}
              </p>
            </div>
            <div>
              <p className="text-1 text-neutral-11">Credit (stablecoin)</p>
              <p className="font-medium">
                {formatMicro(data.totals.creditInStablecoin)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {data.communities.map((community) => {
            const hasCredit = BigInt(community.energyCreditBalance) > 0n;
            const hasDebt = BigInt(community.debtInStablecoin) > 0n;
            return (
              <div
                key={community.communityProxyAddress}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {community.communityProxyAddress}
                    </p>
                    <p className="text-1 text-neutral-11">
                      Activated{' '}
                      {new Date(community.activatedAt).toLocaleDateString()}
                    </p>
                    <p className="text-1 text-neutral-11">
                      Energy token: {community.energyTokenAddress}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={
                        !isMyProfile ||
                        !hasDebt ||
                        Boolean(
                          isSettlingByProxy[community.communityProxyAddress],
                        )
                      }
                      onClick={() =>
                        handleSettle(
                          community.communityProxyAddress,
                          community.debtInStablecoin,
                        )
                      }
                    >
                      Settle Debt
                    </Button>
                    <Button
                      disabled={
                        !isMyProfile ||
                        !hasCredit ||
                        Boolean(
                          isClaimingByProxy[community.communityProxyAddress],
                        )
                      }
                      onClick={() =>
                        handleClaim(
                          community.communityProxyAddress,
                          community.energyCreditBalance,
                        )
                      }
                    >
                      Claim Credit
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-1 text-neutral-11">Energy Credit</p>
                    <p className="font-medium">
                      {formatMicro(community.energyCreditBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-1 text-neutral-11">Debt</p>
                    <p className="font-medium">
                      {formatMicro(community.debtInStablecoin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-1 text-neutral-11">Claimable</p>
                    <p className="font-medium">
                      {formatMicro(community.creditInStablecoin)}
                    </p>
                  </div>
                </div>
                {community.sourceOwnerships.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-1 text-neutral-11">Source ownership</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {community.sourceOwnerships.map((ownership) => (
                        <span
                          key={`${community.communityProxyAddress}-${ownership.sourceId}`}
                          className="rounded border border-border px-2 py-1 text-1 text-neutral-11"
                        >
                          {ownership.sourceId}:{' '}
                          {formatBps(ownership.ownershipBps)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {isMyProfile ? (
          <p className="text-1 text-neutral-11">
            Debt settlement requires prior stablecoin allowance for the energy
            contract.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
