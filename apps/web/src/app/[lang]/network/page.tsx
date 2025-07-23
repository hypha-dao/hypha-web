import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { Button, Container } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { SpaceGroupSlider, SpaceSearch } from '@hypha-platform/epics';
import { findAllSpaces, Space } from '@hypha-platform/core/server';
import { Category } from '@hypha-platform/core/client';
import { PlusIcon } from '@radix-ui/react-icons';
import { getDhoPathGovernance } from '../dho/[id]/@tab/governance/constants';
import { db } from '@hypha-platform/storage-postgres';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
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

  const { lang } = params;

  const getHref = (id: string) => {
    return getDhoPathGovernance(lang, id);
  };

  const spaces = await findAllSpaces({ db }, { search: query });

  const uniqueCategories = extractUniqueCategories(spaces);

  return (
    <Container>
      <Text className="text-9 text-center flex mb-8">
        Explore the Hypha Network
      </Text>
      <div className="flex justify-center">
        <SpaceSearch />
        <Link href={`/${lang}/network/create`} scroll={false}>
          <Button className="ml-2">
            <PlusIcon className="mr-2" />
            Create Space
          </Button>
        </Link>
      </div>
      {uniqueCategories.map((category) => (
        <SpaceGroupSlider
          key={category}
          spaces={spaces.filter((space) =>
            space.categories?.includes(category),
          )}
          type={category}
          getHref={getHref}
        />
      ))}
      <SpaceGroupSlider
        spaces={spaces.filter((space) => space.categories?.length === 0)}
        type={'No Category'}
        getHref={getHref}
      />
    </Container>
  );
}
