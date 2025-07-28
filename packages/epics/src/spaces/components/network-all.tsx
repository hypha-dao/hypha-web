'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { SpaceGroupSlider, SpaceSearch } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import Link from 'next/link';

export function NetworkAll({
  lang,
  spaces,
  uniqueCategories,
  getPathHelper,
}: {
  lang: Locale;
  spaces: Space[];
  uniqueCategories: Category[];
  getPathHelper: (lang: Locale, id: string) => string;
}) {
  const getHref = (id: string) => {
    return getPathHelper(lang, id);
  };

  return (
    <>
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
    </>
  );
}
