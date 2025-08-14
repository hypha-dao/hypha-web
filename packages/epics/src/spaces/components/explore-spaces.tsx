'use client';

import { Category, Space } from "@hypha-platform/core/client";
import { SpaceCardList, SpaceSearch } from '@hypha-platform/epics';
import { Locale } from "@hypha-platform/i18n";
import { Text } from '@radix-ui/themes';
import { Button, Heading, Separator } from "@hypha-platform/ui";
import React from "react";
import Link from "next/link";
import { ChevronDownIcon, PlusIcon } from "@radix-ui/react-icons";

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
    <Text className="flex flex-row text-2">Categores <ChevronDownIcon /></Text>
  );
};

type Order = 'Most Members' | 'Most Active' | 'Most Recent';

const ChooseOrderComboBox = ({
  orders,
}: {
  orders: Order[];
}) => {
  return (
    <Text className="flex flex-row text-2">Order <ChevronDownIcon /></Text>
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
      categories ? spaces.filter((space) =>
        categoriesIntersected(space.categories, categories),
      ) : [],
    [spaces, categories],
  );
  const tags = [
    'Solar panels',
    'Tokenomics',
    'Regenerative economy',
    'Web3',
  ];
  const orders: Order[] = [
    'Most Members',
    'Most Active',
    'Most Recent',
  ];
  const memberCount = 1342;
  const mintedTokens = '$1M';
  return (
    <div className="flex flex-col">
      <Heading size="9" color="secondary" weight="medium" align="center" className="flex flex-col mb-21 mt-14">
        Explore the Hypha Network
      </Heading>
      <div className="flex justify-center">
        <SpaceSearch />
      </div>
      <div className="flex justify-center space-x-2 mt-2 mb-2">
        {tags.map(tag => <span key={tag} className="text-1 text-neutral-500 border rounded-lg p-1">{tag}</span>)}
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex justify-around flex-row columns-3 space-x-3 mt-6 mb-6">
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">{spaces.length}</div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">Spaces</div>
          </div>
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">{memberCount}</div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">Members</div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">{mintedTokens}</div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">Minted Tokens</div>
        </div>
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex flex-row w-full h-4 mt-10 mb-10">
        <Text className="text-5 text-left flex mb-8 grow">
          {categories ? (
            <Text className="text-3 text-left flex mb-8">
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
            <Text className="text-3 text-left flex mb-8">
              <Text className="ml-1 capitalize">
                All
              </Text>
              <Text className="ml-1 mr-1">|</Text>
              {spaces?.length}
            </Text>
          )}
        </Text>
        <ChooseCategoriesComboBox categories={uniqueCategories} />
        <ChooseOrderComboBox orders={orders} />
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
