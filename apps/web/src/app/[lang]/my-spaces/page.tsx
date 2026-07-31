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
    <div className="w-full overflow-auto">
      <Container className="flex flex-col gap-6 py-8 md:gap-8 md:py-10">
        <header className="craft-page-header gap-2">
          <Heading
            size="7"
            color="secondary"
            weight="medium"
            align="left"
            className="craft-page-title flex flex-col text-left"
          >
            <span>{t('allYourSpaces')}</span>
            <span>{t('inOnePlace')}</span>
          </Heading>
          <p className="craft-meta max-w-xl">{t('mySpacesSupport')}</p>
        </header>
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
