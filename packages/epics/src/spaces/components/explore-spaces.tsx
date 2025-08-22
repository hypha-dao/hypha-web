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
  Separator,
} from '@hypha-platform/ui';
import React from 'react';
import Link from 'next/link';
import { PlusIcon } from '@radix-ui/react-icons';
import { categories as categoryOptions } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cva } from 'class-variance-authority';
import { useAuthentication } from '@hypha-platform/authentication';

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

function toLowerHex<A extends `0x${string}`>(a: A): Lowercase<A> {
  return a.toLowerCase() as Lowercase<A>;
}

const CategoryLabel = ({
  selectedSpaces,
  categories,
  className,
}: {
  selectedSpaces: Space[];
  categories?: Category[];
  className?: string | undefined;
}) => {
  return (
    <Text className={cn('text-4 text-left', className)}>
      {categories ? (
        <Text className="text-4 text-left">
          {categories.map((category, index) => {
            const label =
              categoryOptions.find((o) => o.value === category)?.label ??
              category;
            return (
              <Text key={`cat-title-${category}`} className="text-4 ml-1">
                {index !== 0 && ' | '}
                {label}
              </Text>
            );
          })}{' '}
          <Text className="text-4 ml-1 mr-1">|</Text>
          {selectedSpaces?.length}
        </Text>
      ) : (
        <Text className="text-4 text-left">
          <Text className="text-4 ml-1 capitalize">All</Text>
          <Text className="text-4 ml-1 mr-1">|</Text>
          {selectedSpaces?.length}
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
      categories && categories.length > 0
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

  const uniqueMemberAddresses = React.useMemo(() => {
    const acc = new Set<Lowercase<`0x${string}`>>();
    for (const space of selectedSpaces) {
      if (!space.memberAddresses) continue;
      for (const address of space.memberAddresses) {
        acc.add(toLowerHex(address));
      }
    }
    return acc;
  }, [selectedSpaces]);

  const tags = React.useMemo(
    () =>
      uniqueCategories
        .map((category) =>
          categoryOptions.find(
            (option) => !option.archive && option.value === category,
          ),
        )
        .filter(
          (category): category is NonNullable<typeof category> => !!category,
        )
        .sort((a, b) => (a.label > b.label ? 1 : -1)),
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
    const aCount = a.memberAddresses?.length ?? a.memberCount ?? 0;
    const bCount = b.memberAddresses?.length ?? b.memberCount ?? 0;
    return bCount - aCount;
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

  const { isAuthenticated } = useAuthentication();

  return (
    <div className="flex flex-col">
      <Heading
        size="9"
        color="secondary"
        weight="medium"
        align="center"
        className="flex flex-col mb-16"
      >
        <span>Many Spaces,</span>
        <span>One Vibrant Network</span>
      </Heading>
      <div className="flex justify-center">
        <SpaceSearch value={query} />
      </div>
      {/* Restore after bring counters back to top */}
      {/* <div className="flex justify-center space-x-2 space-y-2 mt-3 mb-15 flex-wrap"> */}
      <div className="flex justify-center space-x-2 space-y-2 mt-3 mb-3 flex-wrap">
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
      {/*
        Uncomment following piece when counters
        are needed to be moved to top
      */}
      {/* <Separator className="mt-1 mb-1" />
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
            {uniqueMemberAddresses.size}
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
      <Separator className="mt-1 mb-1" /> */}
      <div className="flex flex-row w-full h-4 pt-10 pb-10 items-center">
        <CategoryLabel
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
            allowEmptyChoice={false}
          />
        </div>
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
      <div className="space-y-6 flex mt-4 mb-7">
        <SpaceCardList lang={lang} spaces={sortedSpaces} pageSize={15} />
      </div>
      <Separator className="mt-1 mb-1" />
      <div className="flex justify-around flex-row columns-3 space-x-3 mt-6 -mb-15">
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
            {uniqueMemberAddresses.size}
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
    </div>
  );
}
