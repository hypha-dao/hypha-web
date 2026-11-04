import { Locale } from '@hypha-platform/i18n';
import {
  getNetworkDirectorySpaces,
  getNetworkGrowth,
  readSpaceCapitals,
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
import { Container } from '@hypha-platform/ui';
import { Suspense } from 'react';

import { NetworkIndexFallback } from './_components/network-index-fallback';

export const maxDuration = 60;

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
    category?: string;
    order?: string;
    view?: string;
  }>;
};

export default async function Index(props: PageProps) {
  const searchParams = await props.searchParams;
  return (
    <div className="w-full min-w-0">
      <Suspense
        fallback={
          <Container className="flex min-w-0 flex-col gap-4 pt-2 pb-3 sm:pt-3 sm:pb-4 lg:pt-3 lg:pb-5">
            <NetworkIndexFallback view={searchParams?.view} />
          </Container>
        }
      >
        <NetworkSpaces {...props} />
      </Suspense>
    </div>
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
  const [spacesResult, growthResult, capitalsResult] = await Promise.all([
    getNetworkDirectorySpaces(
      { db },
      {
        search: query?.trim() || undefined,
        parentOnly: false,
        omitArchived: true,
      },
    ).catch((error: unknown) => {
      console.error('Failed to fetch spaces:', error);
      return [] as Space[];
    }),
    enableNetworkMap
      ? getNetworkGrowth({ db }).catch((error: unknown) => {
          console.error('Failed to load network growth:', error);
          return null;
        })
      : Promise.resolve(null),
    enableNetworkMap
      ? readSpaceCapitals(db).catch((error: unknown) => {
          console.error('Failed to load space capitals:', error);
          return new Map();
        })
      : Promise.resolve(new Map()),
  ]);
  spaces = spacesResult;
  networkGrowth = growthResult;

  const spaceCapitals = enableNetworkMap
    ? Object.fromEntries(
        [...capitalsResult.entries()].map(([id, value]) => [String(id), value]),
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
      spaceCapitals={spaceCapitals}
    />
  );
}
