import { SpaceCard } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Container,
  FilterMenu,
  Carousel,
  CarouselItem,
  CarouselContent,
} from '@hypha-platform/ui';
import { Heading } from 'packages/ui/src/atoms/heading';
import { Text } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import { createSpaceService } from '@hypha-platform/core/server';
import { getDhoPathAgreements } from '../dho/[id]/@tab/agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

type OptionType = {
  label: string;
  value: string;
};

type SpacesFilterType = {
  value: string;
  options: OptionType[];
};

export default async function Index(props: PageProps) {
  const params = await props.params;

  const { lang } = params;

  const spaces = await createSpaceService().getAll();

  const mySpacesCount = 2;

  const filterSettings: SpacesFilterType = {
    value: 'my-spaces',
    options: [
      { label: 'All', value: 'all' },
      { label: 'My Spaces', value: 'my-spaces' },
    ],
  };

  return (
    <div className="w-full overflow-auto">
      <Container>
        <Heading
          className="mb-9 mt-3"
          size="9"
          color="secondary"
          weight="medium"
          align="center"
        >
          All your spaces, in one place
        </Heading>
        <div className="mb-6 justify-between items-center flex">
          <Text className="text-3">My spaces | {mySpacesCount}</Text>
          <div className="flex items-center">
            <FilterMenu
              value={filterSettings.value}
              options={filterSettings.options}
            />
            <Link href={`/${lang}/my-spaces/create`} scroll={false}>
              <Button className="ml-2">
                <PlusIcon className="mr-2" />
                Create Space
              </Button>
            </Link>
          </div>
        </div>
        <div
          data-testid="member-spaces-container"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {spaces.map((space) => (
            <div key={space.id} className="mb-1">
              <Link href={getDhoPathAgreements(lang, space.slug as string)}>
                <SpaceCard
                  description={space.description as string}
                  icon={space.logoUrl || '/placeholder/space-avatar-image.png'}
                  leadImage={
                    space.leadImage || '/placeholder/space-lead-image.png'
                  }
                  members={0}
                  agreements={0}
                  activeAgreements={1}
                  openDiscussions={1}
                  title={space.title as string}
                />
              </Link>
            </div>
          ))}
        </div>
        <div data-testid="recommended-spaces-container" className="w-full">
          <Text className="text-4 font-medium">Spaces you might like</Text>
          <Carousel className="my-6">
            <CarouselContent>
              {spaces.map((space) => (
                <CarouselItem
                  key={space.id}
                  className="mb-5 w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
                >
                  <Link
                    className="w-96"
                    href={getDhoPathAgreements(lang, space.slug as string)}
                  >
                    <SpaceCard
                      description={space.description as string}
                      icon={
                        space.logoUrl || '/placeholder/space-avatar-image.png'
                      }
                      leadImage={
                        space.leadImage || '/placeholder/space-lead-image.png'
                      }
                      members={0}
                      agreements={0}
                      title={space.title as string}
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
