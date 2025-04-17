import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import { SpaceGroupSlider, SpaceSearch } from '@hypha-platform/epics';
import { createSpaceService, Space } from '@hypha-platform/core/server';
import { Category } from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../dho/[id]/@tab/agreements/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
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

  const { lang } = params;

  const getHref = (id: string) => {
    return getDhoPathAgreements(lang, id);
  };

  const spaces = await createSpaceService().getAll();
  const uniqueCategories = extractUniqueCategories(spaces);

  return (
    <Container>
      <Text className="text-9 text-center flex mb-8">
        Explore hundreds of Spaces in the Hypha Network
      </Text>
      <SpaceSearch />
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
