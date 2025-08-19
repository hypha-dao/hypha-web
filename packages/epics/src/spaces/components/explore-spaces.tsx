'use client';

import { Category, Space, SpaceOrder } from '@hypha-platform/core/client';
import { SpaceCardList, SpaceSearch } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Text } from '@radix-ui/themes';
import {
  Badge,
  Button,
  Combobox,
  Heading,
  MultiSelect,
  Separator,
} from '@hypha-platform/ui';
import React from 'react';
import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';
import { categories as categoryOptions } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cva } from 'class-variance-authority';

interface ExploreSpacesProps {
  lang: Locale;
  query?: string;
  spaces: Space[];
  categories?: Category[];
  order?: SpaceOrder;
  uniqueCategories: Category[];
}

const categoriesIntersected = (
  categories1: Category[],
  categories2: Category[],
) => categories1.some((category) => categories2.includes(category));

const orderOptions: {
  value: SpaceOrder;
  label: string;
  searchText: string;
}[] = [
  {
    value: 'mostmembers',
    label: 'Most Members',
    searchText: 'Most Members',
  },
  {
    value: 'mostagreements',
    label: 'Most Agreements',
    searchText: 'Most Agreements',
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
  query,
  spaces,
  categories,
  order,
  uniqueCategories,
}: ExploreSpacesProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const selectedSpaces = React.useMemo(
    () =>
      categories
        ? spaces.filter((space) =>
            categoriesIntersected(space.categories, categories),
          )
        : spaces,
    [spaces, categories],
  );

  const agreementCount = React.useMemo(() => {
    return selectedSpaces.reduce(
      (accumulator: number, { documentCount }) =>
        accumulator + (documentCount ?? 0),
      0,
    );
  }, [selectedSpaces]);

  const memberAddresses = React.useMemo(() => {
    return selectedSpaces.reduce(
      (accumulator: Set<`0x{string}`>, { memberAddresses }) => {
        if (memberAddresses) {
          memberAddresses.forEach((address) => accumulator.add(address));
        }
        return accumulator;
      },
      new Set<`0x{string}`>(),
    );
  }, [selectedSpaces]);

  const tags = React.useMemo(
    () =>
      uniqueCategories
        .map((category) =>
          categoryOptions.find((option) => option.value === category),
        )
        .filter(
          (category): category is NonNullable<typeof category> => !!category,
        ),
    [uniqueCategories],
  );

  const setCategories = React.useCallback(
    (categories: string[]) => {
      const params = new URLSearchParams(searchParams);
      if (categories.length > 0) {
        params.set('category', categories.join(','));
      } else {
        params.delete('category');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace],
  );

  const setOrder = React.useCallback(
    (order: string) => {
      const params = new URLSearchParams(searchParams);
      if (order) {
        params.set('order', order);
      } else {
        params.delete('order');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace],
  );

  const multiSelectVariants = cva(
    'm-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300',
    {
      variants: {
        variant: {
          default:
            'border-foreground/10 text-foreground text-neutral-500 bg-card hover:bg-card/80',
          secondary:
            'border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80',
          destructive:
            'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
          inverted: 'inverted',
        },
      },
      defaultVariants: {
        variant: 'default',
      },
    },
  );

  const compareMembers = (a: Space, b: Space) => {
    return (b.memberCount ?? 0) - (a.memberCount ?? 0);
  };
  const compareAgreements = (a: Space, b: Space) => {
    return (b.documentCount ?? 0) - (a.documentCount ?? 0);
  };
  const compareRecent = (a: Space, b: Space) => {
    return b.id - a.id;
  };

  const sortedSpaces = React.useMemo(() => {
    return [...selectedSpaces].sort((a, b) => {
      switch (order) {
        case 'mostmembers':
          return compareMembers(a, b);
        case 'mostagreements':
          return compareAgreements(a, b);
        case 'mostrecent':
          return compareRecent(a, b);
        default:
          return 0;
      }
    });
  }, [selectedSpaces, order]);

  return (
    <div className="flex flex-col">
      <Heading
        size="9"
        color="secondary"
        weight="medium"
        align="center"
        className="flex flex-col mb-16"
      >
        Explore Spaces in the
        <br />
        Hypha Network
      </Heading>
      <div className="flex justify-center">
        <SpaceSearch value={query} />
      </div>
      <div className="flex justify-center space-x-2 space-y-2 mt-3 mb-15 flex-wrap">
        {tags.map((tag) => (
          <Badge
            key={tag.value}
            className={cn(
              multiSelectVariants({
                variant: categories?.includes(tag.value)
                  ? 'secondary'
                  : 'default',
              }),
            )}
            style={{ cursor: 'pointer', animationDuration: '0s' }}
            onClick={() => {
              const newCategories = categories?.includes(tag.value)
                ? []
                : [tag.value];
              setCategories(newCategories);
            }}
          >
            {tag.label}
          </Badge>
        ))}
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex justify-around flex-row columns-3 space-x-3 mt-6 mb-6">
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">
            {selectedSpaces.length}
          </div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">
            Spaces
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">
            {memberAddresses.size}
          </div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">
            Members
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-center text-7 font-medium">
            {agreementCount}
          </div>
          <div className="flex justify-center text-1 mt-2 text-neutral-500">
            Agreements
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
          <Combobox
            options={orderOptions}
            initialValue={order}
            className="border-0 md:w-40"
            onChange={setOrder}
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
        <SpaceCardList lang={lang} spaces={sortedSpaces} pageSize={15} />
      </div>
    </div>
  );
}
