import { Locale } from '@hypha-platform/i18n';
import {
  getAllSpaces,
  getNetworkGrowth,
  listNetworkSpaceRanks,
  readSpaceCapitals,
  resolveCreatorMapCoordinates,
  parseCategoryGroupFilterParam,
  sortSpacesByOrder,
  SPACE_ORDERS,
  Space,
  SpaceOrder,
  extractUniqueCategoryGroups,
  type NetworkGrowth,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getEnableNetworkMapAsync } from '@hypha-platform/feature-flags';
import { ExploreSpaces } from '@hypha-platform/epics';
import { Suspense } from 'react';

import { NetworkIndexFallback } from './_components/network-index-fallback';
import { NetworkPageShell } from './_components/network-page-shell';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
    category?: string;
    order?: string;
    view?: string;
  }>;
};

export default function Index(props: PageProps) {
  return (
    <NetworkPageShell>
      <Suspense fallback={<NetworkIndexFallback />}>
        <NetworkSpaces {...props} />
      </Suspense>
    </NetworkPageShell>
  );
}

async function NetworkSpaces(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const query = searchParams?.query;
  const categoryGroups = parseCategoryGroupFilterParam(searchParams?.category);
  const orderRaw = searchParams?.order;
  const order: SpaceOrder =
    orderRaw && SPACE_ORDERS.includes(orderRaw as SpaceOrder)
      ? (orderRaw as SpaceOrder)
      : SPACE_ORDERS[0];

  const { lang } = params;
  const enableNetworkMap = await getEnableNetworkMapAsync();

  let spaces: Space[] = [];
  let networkGrowth: NetworkGrowth | null = null;
  const [spacesResult, growthResult, ranksResult] = await Promise.all([
    getAllSpaces({
      search: query?.trim() || undefined,
      parentOnly: false,
      omitArchived: true,
    }).catch((error: unknown) => {
      console.error('Failed to fetch spaces:', error);
      return [] as Space[];
    }),
    enableNetworkMap
      ? getNetworkGrowth({ db }).catch((error: unknown) => {
          console.error('Failed to load network growth:', error);
          return null;
        })
      : Promise.resolve(null),
    listNetworkSpaceRanks({ db }).catch((error: unknown) => {
      console.error('Failed to load network ranks:', error);
      return [];
    }),
  ]);
  spaces = spacesResult;
  networkGrowth = growthResult;

  const creatorMapPins = enableNetworkMap
    ? await resolveCreatorMapCoordinates(spaces, { db }).catch(
        (error: unknown) => {
          console.error('Failed to resolve creator map pins:', error);
          return {};
        },
      )
    : {};

  const spaceCapitals = enableNetworkMap
    ? Object.fromEntries(
        [
          ...(
            await readSpaceCapitals(
              db,
              spaces.map((space) => space.id),
            ).catch((error: unknown) => {
              console.error('Failed to load space capitals:', error);
              return new Map();
            })
          ).entries(),
        ].map(([id, value]) => [String(id), value]),
      )
    : {};

  const uniqueCategoryGroups = extractUniqueCategoryGroups(spaces);

  // Pre-sort on the server so the first paint already matches the order the
  // client applies after hydration. Without this the cards visibly reorder
  // (DB order -> sorted order) on first load.
  const sortedSpaces = sortSpacesByOrder(spaces, order);

  return (
    <ExploreSpaces
      lang={lang}
      query={query}
      spaces={sortedSpaces}
      categoryGroups={categoryGroups.length > 0 ? categoryGroups : undefined}
      order={order}
      uniqueCategoryGroups={uniqueCategoryGroups}
      enableNetworkMap={enableNetworkMap}
      networkGrowth={networkGrowth}
      creatorMapPins={creatorMapPins}
      networkRanks={ranksResult}
      spaceCapitals={spaceCapitals}
    />
  );
}
