import { NextRequest, NextResponse } from 'next/server';
import {
  fetchEnergyTelemetry,
  findAllSpacesByWeb3SpaceIds,
  findBankCustomerBySpaceAndProvider,
  findEnergyCommunityBySpaceId,
  findPersonBySlug,
  getDb,
  getSpaceBankVirtualAccounts,
  resolveSpaceExecutorAddress,
  web3Client,
  DEFAULT_BANK_PROVIDER,
} from '@hypha-platform/core/server';
import {
  buildMemberEnergyFigures,
  energyPpaV2Abi,
  getMemberSpaces,
  pickActivatedBankAccount,
  type MemberEnergyHomeCommunity,
} from '@hypha-platform/core/client';
import { headers } from 'next/headers';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

type AppDb = ReturnType<typeof getDb>;
type SpaceRow = Awaited<ReturnType<typeof findAllSpacesByWeb3SpaceIds>>[number];
type EnergyMapping = NonNullable<
  Awaited<ReturnType<typeof findEnergyCommunityBySpaceId>>
>;

async function safeRead<V>(
  address: `0x${string}`,
  functionName: string,
  args?: readonly unknown[],
): Promise<V | null> {
  try {
    return (await web3Client.readContract({
      address,
      abi: energyPpaV2Abi,
      functionName,
      args,
    } as never)) as V;
  } catch (error) {
    console.warn(
      `[energy/home] ${functionName} failed`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function deviceIdsOf(record: unknown): number[] | null {
  if (!record || typeof record !== 'object') return null;
  const ids = (record as { deviceIds?: readonly bigint[] }).deviceIds;
  if (!ids) return null;
  return ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
}

async function loadCommunity({
  appDb,
  memberAddress,
  mapping,
  space,
  proxy,
}: {
  appDb: AppDb;
  memberAddress: `0x${string}`;
  mapping: EnergyMapping;
  space: SpaceRow;
  proxy: `0x${string}`;
}): Promise<MemberEnergyHomeCommunity | null> {
  if (!space.slug) return null;

  const [debt, memberRecord, sourceIds, ownerships] = await Promise.all([
    safeRead<bigint>(proxy, 'getDebtInStablecoin', [memberAddress]),
    safeRead<{ deviceIds: readonly bigint[] }>(proxy, 'getMember', [
      memberAddress,
    ]),
    safeRead<readonly `0x${string}`[]>(proxy, 'getSourceIds'),
    safeRead<readonly [readonly `0x${string}`[], readonly bigint[]]>(
      proxy,
      'getAllSourceOwnerships',
      [memberAddress],
    ),
  ]);

  const sourceIdList = sourceIds ?? [];
  const sourceRows = await Promise.all(
    sourceIdList.map(async (sourceId) => {
      const row = await safeRead<
        readonly [number, `0x${string}`, bigint, boolean]
      >(proxy, 'getSource', [sourceId]);
      if (!row) return null;
      return { sourceId, price: row[2], active: row[3] };
    }),
  );
  const sources = sourceRows.filter(
    (row): row is NonNullable<typeof row> => row !== null,
  );
  const ownedIds = ownerships?.[0] ?? [];
  const ownedBps = ownerships?.[1] ?? [];
  const ownershipRows = ownedIds.map((sourceId, index) => ({
    sourceId,
    ownershipBps: (ownedBps[index] ?? 0n).toString(),
  }));

  let pricePerKwhCt: bigint | null = null;
  const activeSources = sources.filter(
    (source) => source.active && source.price > 0n,
  );
  const priceById = new Map(
    activeSources.map((source) => [
      source.sourceId.toLowerCase(),
      source.price,
    ]),
  );
  let bestBps = -1;
  for (const owned of ownershipRows) {
    const price = priceById.get(owned.sourceId.toLowerCase());
    const bps = Number(owned.ownershipBps);
    if (price == null || !Number.isFinite(bps) || bps <= bestBps) continue;
    bestBps = bps;
    pricePerKwhCt = price;
  }
  if (pricePerKwhCt == null && activeSources[0]) {
    pricePerKwhCt = activeSources[0].price;
  }

  const [telemetry, treasuryAddress, bank] = await Promise.all([
    (async () => {
      if (mapping.factoryCommunityId == null) return null;
      try {
        return await fetchEnergyTelemetry({
          communityId: mapping.factoryCommunityId,
          period: '12m',
        });
      } catch (error) {
        console.warn(
          '[energy/home] telemetry failed',
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    })(),
    (async () => {
      try {
        return await resolveSpaceExecutorAddress(space);
      } catch (error) {
        console.warn(
          '[energy/home] treasury lookup failed',
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    })(),
    (async () => {
      try {
        const customer = await findBankCustomerBySpaceAndProvider(
          { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
          { db: appDb },
        );
        if (!customer?.providerCustomerId || !space.slug) return null;
        const accounts = await getSpaceBankVirtualAccounts(
          space,
          { spaceSlug: space.slug, limit: 10 },
          { db: appDb },
        );
        return pickActivatedBankAccount(accounts.accounts);
      } catch (error) {
        console.warn(
          '[energy/home] bank lookup failed',
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    })(),
  ]);

  const figures = buildMemberEnergyFigures({
    telemetryEnabled: telemetry?.enabled ?? false,
    consumptionKwh: telemetry?.consumptionKwh ?? [],
    consumptionByMeter: telemetry?.consumptionByMeter ?? [],
    productionBySource: telemetry?.productionBySource ?? [],
    deviceIds: deviceIdsOf(memberRecord),
    ownerships: ownershipRows,
    sourceCount: sourceIdList.length,
    pricePerKwhCt,
    debtMicro: debt == null ? null : debt.toString(),
  });

  return {
    spaceSlug: space.slug,
    spaceTitle: space.title ?? space.slug,
    treasuryAddress,
    bank,
    ...figures,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personSlug: string }> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const appDb = getDb({ authToken });
    const person = await findPersonBySlug({ slug: personSlug }, { db: appDb });
    if (!person?.address) {
      return NextResponse.json({ communities: [] });
    }

    const memberAddress = person.address as `0x${string}`;
    const memberWeb3SpaceIds = await web3Client.readContract(
      getMemberSpaces({ memberAddress }),
    );

    if (memberWeb3SpaceIds.length === 0) {
      return NextResponse.json({ communities: [] });
    }

    const web3SpaceIds = memberWeb3SpaceIds.map((id) => {
      const value = Number(id);
      if (!Number.isSafeInteger(value)) {
        throw new Error(`Invalid web3 space id: ${id.toString()}`);
      }
      return value;
    });

    const spaces = await findAllSpacesByWeb3SpaceIds(
      { web3SpaceIds, parentOnly: false },
      { db: appDb },
    );
    const mappings = await Promise.all(
      spaces.map((space) =>
        findEnergyCommunityBySpaceId(space.id, { db: appDb }),
      ),
    );

    const communities = (
      await Promise.all(
        mappings.map(async (mapping, index) => {
          if (!mapping) return null;
          const space = spaces[index];
          if (!space?.slug) return null;
          const proxy = mapping.communityProxyAddress as `0x${string}`;
          if (!ADDRESS_RE.test(proxy)) return null;
          return loadCommunity({
            appDb,
            memberAddress,
            mapping,
            space,
            proxy,
          });
        }),
      )
    ).filter((row): row is MemberEnergyHomeCommunity => row !== null);

    return NextResponse.json({ communities });
  } catch (error) {
    console.error('Failed to fetch member energy home:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member energy home.' },
      { status: 500 },
    );
  }
}
