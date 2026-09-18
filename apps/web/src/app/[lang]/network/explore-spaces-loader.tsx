import {
  extractUniqueCategoryGroups,
  getAllSpaces,
  parseCategoryGroupFilterParam,
  sortSpacesByOrder,
  SPACE_ORDERS,
  type Space,
  type SpaceOrder,
} from '@hypha-platform/core/server';
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
  try {
    spaces = await getAllSpaces({
      search: query?.trim() || undefined,
      parentOnly: false,
      omitArchived: true,
    });
  } catch (err) {
    console.error('Failed to fetch spaces:', err);
  }

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
    />
  );
}
