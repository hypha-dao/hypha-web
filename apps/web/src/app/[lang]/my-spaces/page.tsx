import { MyFilteredSpaces, MySpacesControls } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { Heading } from '@hypha-platform/ui';
import {
  getAllSpaces,
  SPACE_ORDERS,
  Space,
  SpaceOrder,
} from '@hypha-platform/core/server';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
    order?: string;
  }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const query = searchParams?.query;
  const orderRaw = searchParams?.order;
  const order: SpaceOrder =
    orderRaw && SPACE_ORDERS.includes(orderRaw as SpaceOrder)
      ? (orderRaw as SpaceOrder)
      : SPACE_ORDERS[0];

  const { lang } = params;

  let mySpaces: Space[] = [];
  try {
    mySpaces = await getAllSpaces({ search: query, parentOnly: false });
  } catch (reason) {
    console.error('[my-spaces/page] Failed to fetch filtered spaces', reason);
  }

  const t = await getTranslations('Spaces');

  return (
    <div className="w-full min-w-0">
      <Container className="flex min-w-0 flex-col gap-9 py-9">
        <Heading
          size="9"
          color="secondary"
          weight="medium"
          align="center"
          className="flex flex-col"
        >
          <span>{t('allYourSpaces')}</span>
          <span>{t('inOnePlace')}</span>
        </Heading>
        <Suspense fallback={null}>
          <MySpacesControls
            lang={lang}
            query={query}
            order={order}
            showCreateButton
          />
        </Suspense>
        <MyFilteredSpaces
          lang={lang}
          spaces={mySpaces}
          order={order}
          showLoadMore={false}
        />
      </Container>
    </div>
  );
}
