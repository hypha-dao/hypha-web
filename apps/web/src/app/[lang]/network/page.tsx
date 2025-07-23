import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { findAllSpaces, Space } from '@hypha-platform/core/server';
import { Category } from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { NetworkAll } from './_components/network-all';
import { NetworkSelected } from './_components/network-selected';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams?: Promise<{
    query?: string;
    category?: string;
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
  const categoriesRaw = searchParams?.category as Category;
  console.log('categoriesRaw:', categoriesRaw);
  const categories: Category[] | undefined = categoriesRaw
    ?.split(',')
    .map((category) => category as Category);
  console.log('categories:', categories);

  const { lang } = params;

  const spaces = await findAllSpaces({ db }, { search: query });

  const uniqueCategories = extractUniqueCategories(spaces);

  return (
    <Container>
      {categories && categories.length > 0 ? (
        <NetworkSelected
          lang={lang}
          spaces={spaces}
          categories={categories}
        />
      ) : (
        <NetworkAll
          lang={lang}
          spaces={spaces}
          uniqueCategories={uniqueCategories}
        />
      )}
    </Container>
  );
}
