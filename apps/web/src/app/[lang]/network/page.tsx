import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import {
  getAllSpaces,
  getNetworkGrowth,
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

  // Pre-sort on the server so the first paint already matches the order the
  // client applies after hydration. Without this the cards visibly reorder
  // (DB order -> sorted order) on first load.
  const sortedSpaces = sortSpacesByOrder(spaces, order);

  return (
    <Container className="flex flex-col gap-9 py-9">
      <ExploreSpaces
        lang={lang}
        query={query}
        spaces={sortedSpaces}
        categoryGroups={categoryGroups.length > 0 ? categoryGroups : undefined}
        order={order}
        uniqueCategoryGroups={uniqueCategoryGroups}
        enableNetworkMap={enableNetworkMap}
        networkGrowth={networkGrowth}
      />
    </Container>
  );
}
