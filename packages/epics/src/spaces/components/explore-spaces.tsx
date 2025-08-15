'use client';

import { Category, Space } from '@hypha-platform/core/client';
import { SpaceCardList, SpaceSearch } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Text } from '@radix-ui/themes';
import {
  Button,
  Combobox,
  Heading,
  MultiSelect,
  Separator,
} from '@hypha-platform/ui';
import React from 'react';
import Link from 'next/link';
import { ChevronDownIcon, PlusIcon } from '@radix-ui/react-icons';
import { categories as categoryOptions } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

interface ExploreSpacesProps {
  lang: Locale;
  spaces: Space[];
  categories?: Category[];
  uniqueCategories: Category[];
}

const categoriesIntersected = (
  categories1: Category[],
  categories2: Category[],
) => categories1.some((category) => categories2.includes(category));

const ChooseCategoriesComboBox = ({
  categories,
}: {
  categories: Category[];
}) => {
  return (
    <Text className="flex flex-row text-2">
      Categores <ChevronDownIcon />
    </Text>
  );
};

type Order = 'mostmembers' | 'mostactive' | 'mostrecent';

const ChooseOrderComboBox = ({ orders }: { orders: Order[] }) => {
  return (
    <Text className="flex flex-row text-2">
      Order <ChevronDownIcon />
    </Text>
  );
};

const orderOptions: {
  value: Order;
  label: string;
  searchText: string;
}[] = [
  {
    value: 'mostmembers',
    label: 'Most Members',
    searchText: 'Most Members',
  },
  {
    value: 'mostactive',
    label: 'Most Active',
    searchText: 'Most Active',
  },
  {
    value: 'mostrecent',
    label: 'Most Recent',
    searchText: 'Most Recent',
  },
];

const CategoryLabel = ({
  spaces,
  selectedSpaces,
  categories,
  className,
}: {
  spaces: Space[];
  selectedSpaces: Space[];
  categories?: Category[];
  className?: string | undefined;
}) => {
  return (
    <Text className={cn('text-5 text-left', className)}>
      {categories && selectedSpaces ? (
        <Text className="text-3 text-left">
          {categories.map((category, index) => (
            <Text key={`cat-title-${index}`} className="ml-1 capitalize">
              {index !== 0 && ' | '}
              {category}
            </Text>
          ))}{' '}
          <Text className="ml-1 mr-1">|</Text>
          {selectedSpaces?.length}
        </Text>
      ) : (
        <Text className="text-3 text-left">
          <Text className="ml-1 capitalize">All</Text>
          <Text className="ml-1 mr-1">|</Text>
          {spaces?.length}
        </Text>
      )}
    </Text>
  );
};

export function ExploreSpaces({
  lang,
  spaces,
  categories,
  uniqueCategories,
}: ExploreSpacesProps) {
  const selectedSpaces = React.useMemo(
    () =>
      categories
        ? spaces.filter((space) =>
            categoriesIntersected(space.categories, categories),
          )
        : [],
    [spaces, categories],
  );
  const tags = uniqueCategories.map(category =>
    categoryOptions.find((option =>
      option.value === category)
    )
  )
  .filter(category => !!category);
  const memberCount = 1342;
  const mintedTokens = '$1M';
  return (
    <div className="flex flex-col">
      <Heading
        size="9"
        color="secondary"
        weight="medium"
        align="center"
        className="flex flex-col mb-21 mt-14"
      >
        Explore Spaces in the Hypha Network
      </Heading>
      <div className="flex justify-center">
        <SpaceSearch />
      </div>
      <div className="flex justify-center space-x-2 space-y-2 mt-2 mb-2 flex-wrap">
        {tags.map((tag) => (
          <span
            key={tag.value}
            className="text-1 text-neutral-500 border rounded-lg p-1"
          >
            {tag.label}
          </span>
        ))}
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex justify-around flex-row columns-3 space-x-3 mt-6 mb-6">
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">
            {spaces.length}
          </div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">
            Spaces
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">
            {memberCount}
          </div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">
            Members
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">
            {mintedTokens}
          </div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">
            Minted Tokens
          </div>
        </div>
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex flex-row w-full h-4 pt-10 pb-10 items-center">
        <CategoryLabel
          spaces={spaces}
          selectedSpaces={selectedSpaces}
          categories={categories}
          className="flex grow"
        />
        <div className="flex flex-col grow-0">
          <MultiSelect
            placeholder={'All categories'}
            options={categoryOptions}
            defaultValue={[]}
            className="border-0"
            onValueChange={(values: string[]) => {
              console.log('MultiSelect:', values);
            }}
          />
        </div>
        <div className="flex flex-col grow-0">
          <Combobox
            options={orderOptions}
            initialValue={orderOptions[0]?.value}
            className="border-0 md:w-40"
          />
        </div>
        <Link href={`/${lang}/network/create`} scroll={false}>
          <Button className="ml-2">
            <PlusIcon />
            Create Space
          </Button>
        </Link>
      </div>
      <div className="space-y-6 flex mt-4">
        {categories ? (
          <SpaceCardList lang={lang} spaces={selectedSpaces} />
        ) : (
          <SpaceCardList lang={lang} spaces={spaces} />
        )}
      </div>
    </div>
  );
}
