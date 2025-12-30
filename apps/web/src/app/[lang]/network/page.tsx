import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { getAllSpaces, Space } from '@hypha-platform/core/server';
import {
  CATEGORIES,
  Category,
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

function extractUniqueCategories(spaces: Space[]): Category[] {
  const categoriesSet = new Set<Category>();

  spaces.forEach((space) => {
    if (space.categories) {
      space.categories.forEach((category) => categoriesSet.add(category));
    }
  });

  return Array.from(categoriesSet);
}

export default async function Index(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const query = searchParams?.query;
  const categoriesRaw = searchParams?.category;
  const categories: Category[] | undefined = categoriesRaw
    ?.split(',')
    .map((category) => category.trim() as Category)
    .filter((category): category is Category => {
      return CATEGORIES.includes(category);
    });
  const orderRaw = searchParams?.order;
  const order: SpaceOrder =
    orderRaw && SPACE_ORDERS.includes(orderRaw as SpaceOrder)
      ? (orderRaw as SpaceOrder)
      : SPACE_ORDERS[0];

  const { lang } = params;

  const spaces = await getAllSpaces({
    search: query?.trim() || undefined,
    parentOnly: false,
  });

  const uniqueCategories = extractUniqueCategories(spaces);

  return (
    <Container className="flex flex-col gap-9 py-9">
      <ExploreSpaces
        lang={lang}
        query={query}
        spaces={spaces}
        categories={categories}
        order={order}
        uniqueCategories={uniqueCategories}
      />
    </Container>
  );
}
