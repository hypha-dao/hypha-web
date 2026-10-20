import { MySpacesControls } from '@hypha-platform/epics';
import { MySpacesBoard } from '@web/components/my-spaces-board';
import { MySpacesIconBoard } from '@web/components/my-spaces-icon-board';
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
    mySpaces = await getAllSpaces({ parentOnly: false });
  } catch (reason) {
    console.error('[my-spaces/page] Failed to fetch filtered spaces', reason);
  }

  const t = await getTranslations('Spaces');

  const mobileTitle = (
    <header>
      <p className="mb-2 text-1 font-bold uppercase text-foreground">
        {t('allYourSpaces')}
      </p>
      <h1
        className="text-7 leading-tight sm:text-8"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('inOnePlace')}
      </h1>
    </header>
  );
  const title = (
    <Heading
      size="9"
      color="secondary"
      weight="medium"
      align="center"
      className="flex flex-col"
      style={{ fontFamily: 'var(--font-family-heading)' }}
    >
      <span>{t('allYourSpaces')}</span>
      <span>{t('inOnePlace')}</span>
    </Heading>
  );

  return (
    <div className="w-full min-w-0">
      <Container className="flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:gap-9 xl:py-9">
        <div className="flex flex-col gap-4 xl:hidden">
          {mobileTitle}
          <Suspense fallback={null}>
            <MySpacesControls
              lang={lang}
              query={query}
              order={order}
              showCreateButton
            />
          </Suspense>
          <MySpacesIconBoard
            lang={lang}
            spaces={mySpaces}
            order={order}
            query={query}
          />
        </div>
        <div className="hidden min-w-0 flex-col gap-9 xl:flex">
          <div className="flex min-w-0 flex-col gap-9">
            {title}
            <Suspense fallback={null}>
              <MySpacesControls
                lang={lang}
                query={query}
                order={order}
                showCreateButton
              />
            </Suspense>
          </div>
          <MySpacesBoard
            lang={lang}
            spaces={mySpaces}
            order={order}
            query={query}
          />
        </div>
      </Container>
    </div>
  );
}
