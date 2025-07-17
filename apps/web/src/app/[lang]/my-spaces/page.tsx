import {
  SpaceCardWrapper,
  FilteredSpaces,
  SpaceSearch,
} from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import {
  Container,
  Carousel,
  CarouselItem,
  CarouselContent,
  Button,
} from '@hypha-platform/ui';
import { Heading } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { findAllSpaces, getDb } from '@hypha-platform/core/server';
import { getDhoPathGovernance } from '../dho/[id]/@tab/governance/constants';
import { useMembers } from '@web/hooks/use-members';
import { PlusIcon } from '@radix-ui/react-icons';
import { db } from '@hypha-platform/storage-postgres';

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

  const spaces = await findAllSpaces(
    {
      db,
    },
    { search: query },
  );

  return (
    <div className="w-full overflow-auto">
      <Container className="flex flex-col gap-9 py-9">
        <Heading size="9" color="secondary" weight="medium" align="center">
          All your spaces, in one place
        </Heading>
        <div className="flex justify-center">
          <SpaceSearch />
          <Link href={`/${lang}/my-spaces/create`} scroll={false}>
            <Button className="ml-2">
              <PlusIcon className="mr-2" />
              Create Space
            </Button>
          </Link>
        </div>
        <FilteredSpaces lang={lang} spaces={spaces} useMembers={useMembers} />
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
                    href={getDhoPathGovernance(lang, space.slug as string)}
                  >
                    <SpaceCardWrapper
                      description={space.description as string}
                      icon={space.logoUrl || ''}
                      leadImage={space.leadImage || ''}
                      agreements={space.documentCount}
                      title={space.title as string}
                      spaceSlug={space.slug as string}
                      useMembers={useMembers}
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
