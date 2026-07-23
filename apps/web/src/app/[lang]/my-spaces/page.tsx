import {
  SpaceCard,
  MyFilteredSpaces,
  MySpacesControls,
} from '@hypha-platform/epics';
import { isSpaceArchived } from '@hypha-platform/core/client';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import {
  Container,
  Carousel,
  CarouselItem,
  CarouselContent,
} from '@hypha-platform/ui';
import { Heading } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import {
  getAllSpaces,
  SPACE_ORDERS,
  Space,
  SpaceOrder,
} from '@hypha-platform/core/server';
import { getDhoPathOverview } from '../dho/[id]/@tab/overview/constants';
import { DEFAULT_SPACE_LEAD_IMAGE } from '@hypha-platform/core/client';
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

  let allSpaces: Space[] = [];
  let mySpaces: Space[] = [];
  const [allSpacesResult, mySpacesResult] = await Promise.allSettled([
    getAllSpaces({ parentOnly: false, omitSandbox: true }),
    getAllSpaces({ search: query, parentOnly: false }),
  ]);
  if (allSpacesResult.status === 'fulfilled') {
    allSpaces = allSpacesResult.value;
  } else {
    console.error(
      '[my-spaces/page] Failed to fetch all spaces',
      allSpacesResult.reason,
    );
  }
  if (mySpacesResult.status === 'fulfilled') {
    mySpaces = mySpacesResult.value;
  } else {
    console.error(
      '[my-spaces/page] Failed to fetch filtered spaces',
      mySpacesResult.reason,
    );
  }

  const t = await getTranslations('Spaces');

  return (
    <div className="w-full overflow-auto">
      <Container className="flex flex-col gap-9 py-9 md:py-12">
        <header className="craft-hero craft-rise">
          <Heading
            size="9"
            color="secondary"
            weight="medium"
            align="center"
            className="craft-hero-title"
          >
            <span>{t('allYourSpaces')}</span>
            <span>{t('inOnePlace')}</span>
          </Heading>
        </header>
        <Suspense fallback={null}>
          <MySpacesControls
            lang={lang}
            query={query}
            order={order}
            showCreateButton={(mySpaces?.length ?? 0) > 0}
          />
        </Suspense>
        <MyFilteredSpaces
          lang={lang}
          spaces={mySpaces}
          order={order}
          showLoadMore={false}
        />
        <div
          data-testid="recommended-spaces-container"
          className="w-full space-y-6"
        >
          <Text className="text-4 font-medium pb-4 pt-4">
            {t('spacesYouMightLike')}
          </Text>
          <Carousel className="mt-6">
            <CarouselContent className="pb-5" showScrollbar>
              {allSpaces.map((space) => (
                <CarouselItem
                  key={space.id}
                  className="w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
                >
                  <Link
                    className="flex flex-col flex-1"
                    href={getDhoPathOverview(lang, space.slug as string)}
                  >
                    <SpaceCard
                      description={space.description as string}
                      icon={space.logoUrl || ''}
                      leadImage={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                      members={space.memberCount}
                      agreements={space.documentCount}
                      title={space.title as string}
                      isSandbox={space.flags?.includes('sandbox') ?? false}
                      isDemo={space.flags?.includes('demo') ?? false}
                      isArchived={isSpaceArchived(space)}
                      web3SpaceId={space.web3SpaceId as number}
                      createdAt={space.createdAt}
                      configPath={`${getDhoPathOverview(
                        lang,
                        space.slug,
                      )}/space-configuration`}
                    />
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </Container>
    </div>
  );
}
