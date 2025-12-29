'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { SpaceGroupSlider, SpaceSearch } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Button, Heading } from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useAuthentication } from '@hypha-platform/authentication';

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
  const { isAuthenticated } = useAuthentication();

  return (
    <>
      <Heading size="9" color="secondary" weight="medium" align="center">
        Explore the Hypha Network
      </Heading>
      <div className="flex justify-center">
        <SpaceSearch />
        <Link
          className={!isAuthenticated ? 'cursor-not-allowed' : ''}
          title={!isAuthenticated ? 'Please sign in to use this feature.' : ''}
          href={isAuthenticated ? `/${lang}/network/create` : {}}
          scroll={false}
        >
          <Button disabled={!isAuthenticated} className="ml-2">
            <PlusIcon />
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
