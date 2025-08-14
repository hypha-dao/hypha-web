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
      <div className="flex justify-center">
        {/* Tags here */}
        <></>
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex justify-around flex-row columns-3 space-x-3">
        <div className="flex flex-col">
          <div className="flex justify-center">{spaces.length}</div>
          <div className="flex justify-center">Spaces</div>
          </div>
        <div className="flex flex-col">
          <div className="flex justify-center">{memberCount}</div>
          <div className="flex justify-center">Members</div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-center">{mintedTokens}</div>
          <div className="flex justify-center">Minted Tokens</div>
        </div>
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex justify-left w-full">
        <Text className="text-5 text-left flex mb-8 grow">
          {categories ? (
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
          ) : (
            <Text className="text-5 text-left flex mb-8">
              <Text className="ml-1 capitalize">
                All
              </Text>
              <Text className="ml-1 mr-1">|</Text>
              {spaces?.length}
            </Text>
          )}
        </Text>
        {/* Choose Categores*/}
        <Text className="flex flex-row">Categores <ChevronDownIcon /></Text>
        {/* Choose Order*/}
        <Text className="flex flex-row">Order <ChevronDownIcon /></Text>
        <Link href={`/${lang}/network/create`} scroll={false}>
          <Button className="ml-2">
            <PlusIcon />
            Create Space
          </Button>
        </Link>
      </div>
      <div className="space-y-6 flex mt-6">
        {categories ? (
          <SpaceCardList lang={lang} spaces={selectedSpaces} />
        ) : (
          <SpaceCardList lang={lang} spaces={spaces} />
        )}
      </div>
    </div>
  );
}
