import {
  extractUniqueCategoryGroups,
  getAllSpaces,
  getNetworkGrowth,
  parseCategoryGroupFilterParam,
  sortSpacesByOrder,
  SPACE_ORDERS,
  type NetworkGrowth,
  type Space,
  type SpaceOrder,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { ExploreSpaces, NetworkLoadingGrid } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

export function NetworkExploreFallback() {
  return (
    <NetworkLoadingGrid
      count={12}
      cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    />
  );
}

export async function ExploreSpacesLoader({
  lang,
  query,
  category,
  orderRaw,
  enableNetworkMap,
}: {
  lang: Locale;
  query?: string;
  category?: string;
  orderRaw?: string;
  enableNetworkMap: boolean;
}) {
  const categoryGroups = parseCategoryGroupFilterParam(category);
  const order: SpaceOrder =
    orderRaw && SPACE_ORDERS.includes(orderRaw as SpaceOrder)
      ? (orderRaw as SpaceOrder)
      : SPACE_ORDERS[0];

  let spaces: Space[] = [];
  let networkGrowth: NetworkGrowth | null = null;
  const [spacesResult, growthResult] = await Promise.all([
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
  ]);
  spaces = spacesResult;
  networkGrowth = growthResult;

  const uniqueCategoryGroups = extractUniqueCategoryGroups(spaces);
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
      showHeading={false}
      networkGrowth={networkGrowth}
    />
  );
}
