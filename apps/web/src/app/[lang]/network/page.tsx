import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { getAllSpaces, Space } from '@hypha-platform/core/server';
import { getEnableNetworkMapAsync } from '@hypha-platform/feature-flags';
import {
  extractUniqueCategoryGroups,
  parseCategoryGroupFilterParam,
  SPACE_ORDERS,
  SpaceOrder,
} from '@hypha-platform/core/client';
import { ExploreSpaces } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
    category?: string;
    order?: string;
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

  return (
    <Container className="flex flex-col gap-9 py-9">
      <ExploreSpaces
        lang={lang}
        query={query}
        spaces={spaces}
        categoryGroups={categoryGroups.length > 0 ? categoryGroups : undefined}
        order={order}
        uniqueCategoryGroups={uniqueCategoryGroups}
        enableNetworkMap={enableNetworkMap}
      />
    </Container>
  );
}
