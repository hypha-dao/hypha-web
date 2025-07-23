'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { CategorySpaces } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import Link from 'next/link';

export function NetworkSelected({
  lang,
  spaces,
  categories,
}: {
  lang: Locale;
  spaces: Space[];
  categories: Category[];
}) {
  return (
    <>
      <div className="mb-6 flex items-center">
        <Link
          href={`/${lang}/network`}
          className="cursor-pointer flex items-center"
        >
          <ChevronLeftIcon width={16} height={16} />
          <Text className="text-sm">My Spaces</Text>
        </Link>
        <Text className="text-sm text-gray-400 ml-1 font-medium capitalize">
          {' '}
          / {categories[0]}
        </Text>
      </div>
      <Text className="text-9 text-center flex mb-8">
        Category Spaces
      </Text>
      {/* TODO: search input */}
      <CategorySpaces
        lang={lang}
        spaces={spaces}
        categories={categories}
      />
    </>
  );
}
