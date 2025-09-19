import {
  SpaceCard,
  FilteredSpaces,
  SpaceSearch,
  AuthenticatedLinkButton,
} from '@hypha-platform/epics';
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
import { getAllSpaces } from '@hypha-platform/core/server';
import { getDhoPathAgreements } from '../dho/[id]/@tab/agreements/constants';
import { PlusIcon } from '@radix-ui/react-icons';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
  }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const query = searchParams?.query;

  const { lang } = params;

  const spaces = await getAllSpaces({
    search: query,
    parentOnly: false,
    omitSandbox: true,
  });

  return (
    <div className="w-full overflow-auto">
      <Container className="flex flex-col gap-9 py-9">
        <Heading
          size="9"
          color="secondary"
          weight="medium"
          align="center"
          className="flex flex-col"
        >
          <span>All your Spaces,</span>
          <span> in One Place</span>
        </Heading>
        <div className="flex justify-center">
          <SpaceSearch />
          {spaces?.length > 0 ? (
            <AuthenticatedLinkButton
              hideInsteadDisabled
              href={`/${lang}/my-spaces/create`}
            >
              <PlusIcon />
              Create Space
            </AuthenticatedLinkButton>
          ) : null}
        </div>
        <FilteredSpaces lang={lang} spaces={spaces} showLoadMore={false} />
        <div
          data-testid="recommended-spaces-container"
          className="w-full space-y-6"
        >
          <Text className="text-4 font-medium">Spaces you might like</Text>
          <Carousel>
            <CarouselContent>
              {spaces.map((space) => (
                <CarouselItem
                  key={space.id}
                  className="w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
                >
                  <Link
                    className="flex flex-col flex-1"
                    href={getDhoPathAgreements(lang, space.slug as string)}
                  >
                    <SpaceCard
                      description={space.description as string}
                      icon={space.logoUrl || ''}
                      leadImage={space.leadImage || ''}
                      members={space.memberCount}
                      agreements={space.documentCount}
                      title={space.title as string}
                      isSandbox={space.flags?.includes('sandbox') ?? false}
                      isDemo={space.flags?.includes('demo') ?? false}
                      web3SpaceId={space.web3SpaceId as number}
                      configPath={`${getDhoPathAgreements(
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
