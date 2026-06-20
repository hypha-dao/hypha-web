import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import {
  extractUniqueCategoryGroups,
  getAllSpaces,
  parseCategoryGroupFilterParam,
  SPACE_ORDERS,
  Space,
  SpaceOrder,
} from '@hypha-platform/core/server';
import { getEnableNetworkMapAsync } from '@hypha-platform/feature-flags';
import { ExploreSpaces } from '@hypha-platform/epics';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
    category?: string;
    order?: string;
    view?: string;
  }>;
};

function buildNetworkPageSearchParams({
  query,
  category,
  order,
  view,
}: {
  query?: string;
  category?: string;
  order?: string;
  view?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (query?.trim()) params.set('query', query.trim());
  if (category) params.set('category', category);
  if (order) params.set('order', order);
  if (view) params.set('view', view);
  return params;
}

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
  const viewParam = searchParams?.view;

  if (enableNetworkMap && viewParam !== 'list' && viewParam !== 'map') {
    const nextParams = buildNetworkPageSearchParams({
      query,
      category: searchParams?.category,
      order: orderRaw,
      view: 'map',
    });
    const queryString = nextParams.toString();
    redirect(`/${lang}/network${queryString ? `?${queryString}` : ''}`);
  }

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
