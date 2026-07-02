'use client';

import React from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import { erc20Abi, formatUnits } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import {
  energyPpaV2Abi,
  publicClient,
  TOKENS,
} from '@hypha-platform/core/client';
import { getDhoPathEnergy } from '../../../common/get-path-function';
import { useUserEnergy } from '../../hooks/use-user-energy';
import type { Locale } from '@hypha-platform/i18n';

const formatStablecoinMicro = (value: string) => {
  try {
    return Number(formatUnits(BigInt(value), 6)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  } catch {
    return value;
  }
};

/** Internal energy-credit line (signed integer on the PPA, not ERC-20 decimals). */
const formatInternalCredits = (value: string) => {
  try {
    const n = BigInt(value);
    const neg = n < 0n;
    const v = neg ? -n : n;
    return `${neg ? '−' : ''}${v.toLocaleString()}`;
  } catch {
    return value;
  }
};

const formatBps = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `${(parsed / 100).toFixed(2)}%`;
};

const shortAddr = (a: string) =>
  a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

async function waitForAllowance(
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  required: bigint,
) {
  const maxAttempts = 45;
  const delayMs = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const live = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    });
    if (live >= required) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Timed out waiting for stablecoin allowance.');
}

export const UserEnergySection = ({
  personSlug,
  isMyProfile,
  lang,
}: {
  personSlug: string;
  isMyProfile?: boolean;
  lang: string;
}) => {
  const { data, isLoading, refresh } = useUserEnergy(personSlug);
  const { client } = useSmartWallets();
  const walletReady = Boolean(client);
  const [isClaimingByProxy, setIsClaimingByProxy] = React.useState<
    Record<string, boolean>
  >({});
  const [isSettlingByProxy, setIsSettlingByProxy] = React.useState<
    Record<string, boolean>
  >({});

  const stablecoinToken = React.useMemo(
    () => TOKENS.find((t) => t.symbol === 'USDC'),
    [],
  );

  const handleClaim = async (
    communityProxyAddress: `0x${string}`,
    amount: string,
  ) => {
    if (!client) return;
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
    if (!client) return;
    const amount = BigInt(stablecoinAmount);
    if (amount <= 0n) return;

    const userAddress = client.account?.address as `0x${string}` | undefined;
    const payToken = stablecoinToken?.address as `0x${string}` | undefined;
    if (!userAddress || !payToken) {
      throw new Error('USDC payment token is not configured for this app.');
    }

    setIsSettlingByProxy((prev) => ({
      ...prev,
      [communityProxyAddress]: true,
    }));
    try {
      const current = await publicClient.readContract({
        address: payToken,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userAddress, communityProxyAddress],
      });
      if (current < amount) {
        const approveHash = await client.writeContract({
          address: payToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [communityProxyAddress, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await waitForAllowance(
          payToken,
          userAddress,
          communityProxyAddress,
          amount,
        );
      }

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
        <CardTitle>Energy communities</CardTitle>
        <CardDescription>
          Settlement credit on the energy PPA (internal units) and USDC amounts
          for debt or claims. Debt settlement uses Base USDC (
          {stablecoinToken?.address ?? 'not configured'}) — ensure your
          community&apos;s PPA uses the same stablecoin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.totals ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-1 text-neutral-11">Energy credit (internal)</p>
              <p className="font-medium">
                {formatInternalCredits(data.totals.energyCreditBalance)}
              </p>
            </div>
            <div>
              <p className="text-1 text-neutral-11">Debt (USDC)</p>
              <p className="font-medium">
                {formatStablecoinMicro(data.totals.debtInStablecoin)}
              </p>
            </div>
            <div>
              <p className="text-1 text-neutral-11">Claimable (USDC)</p>
              <p className="font-medium">
                {formatStablecoinMicro(data.totals.creditInStablecoin)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {data.communities.map((community) => {
            const hasCredit = BigInt(community.energyCreditBalance) > 0n;
            const hasDebt = BigInt(community.debtInStablecoin) > 0n;
            const energyHref =
              community.spaceSlug != null
                ? getDhoPathEnergy(lang as Locale, community.spaceSlug)
                : null;
            return (
              <div
                key={community.communityProxyAddress}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {community.spaceTitle ?? 'Energy community'}
                    </p>
                    {energyHref ? (
                      <Link
                        href={energyHref}
                        className="text-1 text-accent-11 hover:underline"
                      >
                        Open space energy dashboard
                      </Link>
                    ) : null}
                    <p className="text-1 text-neutral-11">
                      Activated{' '}
                      {new Date(community.activatedAt).toLocaleDateString()}
                    </p>
                    <p className="font-mono text-1 text-neutral-11 break-all">
                      PPA {shortAddr(community.communityProxyAddress)}
                    </p>
                    <p className="font-mono text-1 text-neutral-11 break-all">
                      Energy token {shortAddr(community.energyTokenAddress)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={
                        !walletReady ||
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
                      Settle debt (USDC)
                    </Button>
                    <Button
                      disabled={
                        !walletReady ||
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
                      Claim credit
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-1 text-neutral-11">Energy credit</p>
                    <p className="font-medium">
                      {formatInternalCredits(community.energyCreditBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-1 text-neutral-11">Debt (USDC)</p>
                    <p className="font-medium">
                      {formatStablecoinMicro(community.debtInStablecoin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-1 text-neutral-11">Claimable (USDC)</p>
                    <p className="font-medium">
                      {formatStablecoinMicro(community.creditInStablecoin)}
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
                          {ownership.sourceId.length > 14
                            ? `${ownership.sourceId.slice(
                                0,
                                10,
                              )}…${ownership.sourceId.slice(-4)}`
                            : ownership.sourceId}
                          : {formatBps(ownership.ownershipBps)}
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
            Settle debt approves the PPA contract to pull the quoted USDC from
            your smart wallet, then calls{' '}
            <code className="text-1">settleOwnDebt</code>.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
