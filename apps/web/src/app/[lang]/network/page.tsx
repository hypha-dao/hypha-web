import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { findAllSpaces, Space } from '@hypha-platform/core/server';
import { CATEGORIES, Category } from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { useMembers } from '@web/hooks/use-members';
import { getDhoPathGovernance, NetworkAll, NetworkSelected } from '@hypha-platform/epics';

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
  const categoriesRaw = searchParams?.category;
  const categories: Category[] | undefined = categoriesRaw
    ?.split(',')
    .map((category) => category.trim() as Category)
    .filter((category): category is Category => {
      return CATEGORIES.includes(category);
    });

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
          uniqueCategories={uniqueCategories}
          useMembers={useMembers}
        />
      ) : (
        <NetworkAll
          lang={lang}
          spaces={spaces}
          uniqueCategories={uniqueCategories}
          getPathHelper={getDhoPathGovernance}
        />
      )}
    </Container>
  );
}
