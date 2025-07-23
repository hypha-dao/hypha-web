'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { CategorySearch, SpaceCardList, UseMembers } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import Link from 'next/link';

const categoriesIntersected = (
  categories1: Category[],
  categories2: Category[],
) =>
  categories1.filter((category) => categories2.includes(category)).length > 0;

export function NetworkSelected({
  lang,
  spaces,
  categories,
  uniqueCategories,
  useMembers,
}: {
  lang: Locale;
  spaces: Space[];
  categories: Category[];
  uniqueCategories: Category[];
  useMembers: UseMembers;
}) {
  const selectedSpaces = spaces.filter((space) =>
    categoriesIntersected(space.categories, categories),
  );
  const categorySuggestions = uniqueCategories.map(
    category => ({ title: String(category) })
  );
  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center">
        <Link
          href={`/${lang}/network`}
          className="cursor-pointer flex items-center"
        >
          <ChevronLeftIcon width={16} height={16} />
          <Text className="text-sm">Home</Text>
        </Link>
        <Text className="text-sm text-gray-400 ml-1 font-medium"> / </Text>
        {categories.map((category, index) => (
          <Text
            key={`cat-${index}`}
            className="text-sm text-gray-400 ml-1 font-medium capitalize"
          >
            {index !== 0 && ' | '}
            {category}
          </Text>
        ))}
      </div>
      <Text className="text-5 text-left flex mb-8">
        {categories.map((category, index) => (
          <Text key={`cat-title-${index}`} className="ml-1 capitalize">
            {index !== 0 && ' | '}
            {category}
          </Text>
        ))}{' '}
        <Text className="ml-1 mr-1">|</Text>
        {selectedSpaces?.length}
      </Text>
      <CategorySearch suggestions={categorySuggestions} />
      <div className="space-y-6 flex mt-6">
        <SpaceCardList
          lang={lang}
          spaces={selectedSpaces}
          useMembers={useMembers}
        />
      </div>
    </div>
  );
}
