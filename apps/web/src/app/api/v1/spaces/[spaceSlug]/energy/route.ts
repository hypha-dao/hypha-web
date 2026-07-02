import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  findEnergyCommunityBySpaceId,
  isMissingEnergyCommunitiesTableError,
  upsertEnergyCommunityActivation,
  web3Client,
  type DatabaseInstance,
} from '@hypha-platform/core/server';
import {
  ENERGY_PPA_CHAIN_ID,
  energyPpaV2Abi,
  energyPpaV2FactoryAbi,
  getEnergyPpaFactoryAddress,
} from '@hypha-platform/core/client';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { hexToString } from 'viem';

const SOURCE_TYPES: Record<number, string> = {
  0: 'SOLAR',
  1: 'BATTERY',
};

const BASE_PURPOSES = ['SELF_CONSUMPTION', 'MIN_CO2', 'LOWEST_PRICE'];
const SOCIAL_MODES = ['NONE', 'FIXED', 'VARIABLE'];

const toLowerHex = (address: string) => address.toLowerCase() as `0x${string}`;

type EnergyCommunityActivation = {
  spaceId: number;
  chainId: number;
  communityProxyAddress: string;
  energyTokenAddress: string;
  adminAddress: string;
  factoryCommunityId: number | null;
  activatedAt: Date;
};

/**
 * Hypha links a space to `EnergyPPAv2Factory.adminCommunities[admin]`.
 * The Enable Energy Community proposal sets `admin` to an arbitrary address;
 * it is often the **space executor** (smart account) rather than `spaces.address`
 * (space contract). Try space wallet first, then fall back to `getSpaceExecutor`.
 */
async function syncEnergyCommunityFromFactory(input: {
  spaceId: number;
  spaceAddress: string | null;
  web3SpaceId: number | null;
  /** Server pool (`db`); avoids Neon JWT `authenticated` lacking sequence grants on `energy_communities`. */
  persistDb: DatabaseInstance;
}): Promise<EnergyCommunityActivation | null> {
  const factoryAddress = getEnergyPpaFactoryAddress();
  const chainId = ENERGY_PPA_CHAIN_ID;
  const adminCandidates: `0x${string}`[] = [];
  const seen = new Set<string>();

  const pushAdmin = (raw: string | null | undefined) => {
    if (!raw || typeof raw !== 'string') return;
    const t = raw.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    adminCandidates.push(t as `0x${string}`);
  };

  pushAdmin(input.spaceAddress ?? undefined);

  const spaceFactoryAddr =
    daoSpaceFactoryImplementationAddress[
      chainId as keyof typeof daoSpaceFactoryImplementationAddress
    ];
  if (input.web3SpaceId != null && spaceFactoryAddr) {
    try {
      const executor = await web3Client.readContract({
        address: spaceFactoryAddr as `0x${string}`,
        abi: daoSpaceFactoryImplementationAbi,
        functionName: 'getSpaceExecutor',
        args: [BigInt(input.web3SpaceId)],
      });
      pushAdmin(executor as string);
    } catch (e) {
      console.warn('[spaces/energy] getSpaceExecutor failed', e);
    }
  }

  for (const admin of adminCandidates) {
    let communityIds: readonly bigint[];
    try {
      communityIds = await web3Client.readContract({
        address: factoryAddress,
        abi: energyPpaV2FactoryAbi,
        functionName: 'getAdminCommunities',
        args: [admin],
      });
    } catch (e) {
      console.warn(
        `[spaces/energy] getAdminCommunities failed for admin ${admin}`,
        e,
      );
      continue;
    }

    const latestCommunityId = communityIds.at(-1);
    if (latestCommunityId === undefined) continue;

    let communityRecord: readonly [
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      bigint,
    ];
    try {
      communityRecord = (await web3Client.readContract({
        address: factoryAddress,
        abi: energyPpaV2FactoryAbi,
        functionName: 'communities',
        args: [latestCommunityId],
      })) as typeof communityRecord;
    } catch (e) {
      console.warn(
        `[spaces/energy] communities(${latestCommunityId}) read failed`,
        e,
      );
      continue;
    }

    const activation: EnergyCommunityActivation = {
      spaceId: input.spaceId,
      chainId: Number(chainId),
      communityProxyAddress: communityRecord[0],
      energyTokenAddress: communityRecord[1],
      adminAddress: communityRecord[2],
      factoryCommunityId: Number(latestCommunityId),
      activatedAt: new Date(Number(communityRecord[3]) * 1000),
    };

    try {
      return (
        (await upsertEnergyCommunityActivation(activation, {
          db: input.persistDb,
        })) ?? activation
      );
    } catch (e) {
      if (isMissingEnergyCommunitiesTableError(e)) {
        console.warn(
          '[spaces/energy] energy_communities table is missing; returning on-chain activation without persistence.',
        );
        return activation;
      }
      console.warn('[spaces/energy] upsertEnergyCommunityActivation failed', e);
      return null;
    }
  }

  return null;
}

const decodeSourceId = (value: `0x${string}`) => {
  try {
    const parsed = hexToString(value, { size: 32 })
      .replace(/\u0000/g, '')
      .trim();
    return parsed.length > 0 ? parsed : value;
  } catch {
    return value;
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId == null) {
      return NextResponse.json({ enabled: false });
    }

    /**
     * Gate access via the standard transparency-matrix check, BUT never let a
     * transient RPC failure inside `checkSpaceAccess` (it calls
     * `publicClient.readContract(getSpaceVisibility(...))` against a public
     * Base RPC that throttles aggressively) turn into a 500 here. Everything
     * we eventually return (community proxy, members, sources, fees…) is
     * already public on-chain data readable by anyone via Basescan, so on
     * verifier infrastructure failure we fall through and treat the request
     * as anonymous-public rather than serving a misleading 500.
     */
    const access = await checkSpaceAccess(request, space.web3SpaceId as number);
    if (!access.hasAccess && access.response) {
      const status = access.response.status;
      if (status === 401 || status === 403) {
        return access.response;
      }
      console.warn(
        `[spaces/energy] checkSpaceAccess returned ${status} — falling through (public on-chain data).`,
      );
    }

    let mapping: EnergyCommunityActivation | null =
      await findEnergyCommunityBySpaceId(space.id, { db });

    if (!mapping) {
      try {
        mapping = await syncEnergyCommunityFromFactory({
          spaceId: space.id,
          spaceAddress: space.address ?? null,
          web3SpaceId: space.web3SpaceId,
          persistDb: db,
        });
      } catch (e) {
        // Never let factory sync turn into a 500 — the UI just renders
        // "energy not enabled yet" when this path fails.
        console.warn('[spaces/energy] syncEnergyCommunityFromFactory threw', e);
        mapping = null;
      }
    }

    if (!mapping) {
      return NextResponse.json({ enabled: false });
    }

    const communityProxy = toLowerHex(mapping.communityProxyAddress);

    /**
     * Read a single view function on the community proxy without ever throwing.
     * Returns `null` on revert / RPC failure and logs a warning so the route
     * can still surface partial data (`enabled: true` + activation) instead of
     * 500ing the whole request. Important because:
     *  - public Base RPC rate-limits aggressively (multi-call batches still
     *    occasionally fail);
     *  - misconfigured proposals (e.g. stablecoin set to a non-ERC20) make
     *    individual reads revert while the community itself is valid.
     */
    const safeRead = async <V>(
      functionName: Parameters<
        typeof web3Client.readContract
      >[0] extends infer T
        ? T extends { functionName: infer F }
          ? F
          : never
        : never,
      args?: readonly unknown[],
    ): Promise<V | null> => {
      try {
        return (await web3Client.readContract({
          address: communityProxy,
          abi: energyPpaV2Abi,
          functionName: functionName as never,
          ...(args ? { args: args as never } : {}),
        })) as V;
      } catch (e: unknown) {
        const message =
          (e as { shortMessage?: string })?.shortMessage ||
          (e as Error)?.message ||
          String(e);
        console.warn(
          `[spaces/energy] readContract(${String(
            functionName,
          )}) failed on ${communityProxy}: ${message}`,
        );
        return null;
      }
    };

    const [
      communityFeeBps,
      aggregatorFeeBps,
      gridBalance,
      settledBalance,
      contractStablecoinBalance,
      zeroSumStatus,
      sourceIds,
      memberAddresses,
      communityRoleAddress,
      aggregatorRoleAddress,
      gridOperatorAddress,
      exportDeviceId,
    ] = await Promise.all([
      safeRead<number>('getCommunityFeeBps'),
      safeRead<number>('getAggregatorFeeBps'),
      safeRead<bigint>('getGridBalance'),
      safeRead<bigint>('getSettledBalance'),
      safeRead<bigint>('getContractStablecoinBalance'),
      safeRead<readonly [boolean, bigint]>('verifyZeroSum'),
      safeRead<readonly `0x${string}`[]>('getSourceIds'),
      safeRead<readonly `0x${string}`[]>('getMemberAddresses'),
      safeRead<`0x${string}`>('getCommunityAddress'),
      safeRead<`0x${string}`>('getAggregatorAddress'),
      safeRead<`0x${string}`>('getGridOperator'),
      safeRead<bigint>('getExportDeviceId'),
    ]);

    const sourceIdList = sourceIds ?? [];
    const sourceResults = await Promise.all(
      sourceIdList.map((sourceId) =>
        safeRead<readonly [number, `0x${string}`, bigint, boolean]>(
          'getSource',
          [sourceId],
        ),
      ),
    );

    const sources = sourceResults
      .map((value, index) => {
        const sourceId = sourceIdList[index];
        if (!sourceId || !value) {
          return null;
        }
        return {
          sourceId,
          sourceLabel: decodeSourceId(sourceId),
          sourceType: SOURCE_TYPES[Number(value[0])] ?? 'UNKNOWN',
          ownershipToken: value[1],
          basePricePerKwh: value[2].toString(),
          active: value[3],
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const memberAddressList = memberAddresses ?? [];

    // Per-member on-chain detail: signed energy-credit balance (positive =
    // holds credit, negative = owes), the source ids this member co-owns
    // (with ownership bps) and the consumption meter ids registered for the
    // member. Powers the Ownership, Credits and per-consumer telemetry views.
    const memberDetails = await Promise.all(
      memberAddressList.map(async (rawAddress) => {
        const address = rawAddress.toLowerCase() as `0x${string}`;
        const [
          creditBalance,
          debtStablecoin,
          creditStablecoin,
          ownerships,
          memberRecord,
        ] = await Promise.all([
          safeRead<bigint>('getEnergyCreditBalance', [address]),
          safeRead<bigint>('getDebtInStablecoin', [address]),
          safeRead<bigint>('getCreditInStablecoin', [address]),
          safeRead<readonly [readonly `0x${string}`[], readonly bigint[]]>(
            'getAllSourceOwnerships',
            [address],
          ),
          safeRead<{
            memberAddress: `0x${string}`;
            deviceIds: readonly bigint[];
            isActive: boolean;
            metadataHash: `0x${string}`;
          }>('getMember', [address]),
        ]);
        const ownedIds = ownerships ? ownerships[0] : [];
        const ownedBps = ownerships ? ownerships[1] : [];
        return {
          address,
          energyCreditBalance:
            creditBalance !== null ? creditBalance.toString() : null,
          debtInStablecoin:
            debtStablecoin !== null ? debtStablecoin.toString() : null,
          creditInStablecoin:
            creditStablecoin !== null ? creditStablecoin.toString() : null,
          deviceIds: memberRecord
            ? memberRecord.deviceIds.map((id) => Number(id))
            : null,
          ownerships: ownedIds.map((sourceId, index) => ({
            sourceId,
            sourceLabel: decodeSourceId(sourceId),
            ownershipBps: Number(ownedBps[index] ?? 0n),
          })),
        };
      }),
    );

    const [optimizationConfig, socialWalletsRaw] = await Promise.all([
      safeRead<readonly [readonly number[], number, bigint, number, boolean]>(
        'getOptimizationConfig',
      ),
      safeRead<readonly { wallet: `0x${string}`; shareBps: number }[]>(
        'getSocialWallets',
      ),
    ]);

    const optimization = optimizationConfig
      ? {
          configured: optimizationConfig[4],
          purposeRanking: optimizationConfig[0].map(
            (purpose) =>
              BASE_PURPOSES[Number(purpose)] ?? `UNKNOWN(${purpose})`,
          ),
          socialMode: SOCIAL_MODES[Number(optimizationConfig[1])] ?? 'NONE',
          socialFixedKwh: optimizationConfig[2].toString(),
          socialVariableBps: Number(optimizationConfig[3]),
          socialWallets: (socialWalletsRaw ?? []).map((wallet) => ({
            wallet: wallet.wallet.toLowerCase() as `0x${string}`,
            shareBps: Number(wallet.shareBps),
          })),
        }
      : null;

    return NextResponse.json({
      enabled: true,
      activation: {
        spaceId: mapping.spaceId,
        chainId: mapping.chainId,
        communityProxyAddress: mapping.communityProxyAddress,
        energyTokenAddress: mapping.energyTokenAddress,
        adminAddress: mapping.adminAddress,
        factoryCommunityId: mapping.factoryCommunityId,
        activatedAt: mapping.activatedAt.toISOString(),
      },
      overview: {
        memberCount: memberAddressList.length,
        sourceCount: sourceIdList.length,
        communityFeeBps:
          communityFeeBps !== null ? Number(communityFeeBps) : null,
        aggregatorFeeBps:
          aggregatorFeeBps !== null ? Number(aggregatorFeeBps) : null,
        gridBalance: gridBalance !== null ? gridBalance.toString() : null,
        settledBalance:
          settledBalance !== null ? settledBalance.toString() : null,
        contractStablecoinBalance:
          contractStablecoinBalance !== null
            ? contractStablecoinBalance.toString()
            : null,
        zeroSumOk: zeroSumStatus ? zeroSumStatus[0] : null,
        zeroSumDelta: zeroSumStatus ? zeroSumStatus[1].toString() : null,
      },
      roles: {
        communityAddress: communityRoleAddress
          ? (communityRoleAddress.toLowerCase() as `0x${string}`)
          : null,
        aggregatorAddress: aggregatorRoleAddress
          ? (aggregatorRoleAddress.toLowerCase() as `0x${string}`)
          : null,
        gridOperator: gridOperatorAddress
          ? (gridOperatorAddress.toLowerCase() as `0x${string}`)
          : null,
        exportDeviceId:
          exportDeviceId !== null ? exportDeviceId.toString() : null,
      },
      members: memberAddressList.map((a) => a.toLowerCase() as `0x${string}`),
      memberDetails,
      sources,
      optimization,
    });
  } catch (error) {
    console.error('Failed to fetch space energy data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space energy data.' },
      { status: 500 },
    );
  }
}
