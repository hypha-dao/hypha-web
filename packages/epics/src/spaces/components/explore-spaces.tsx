'use client';

import {
  Category,
  Space,
  SpaceOrder,
  categories as categoryOptions,
  hasSpaceMapLocation,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import {
  NetworkAddLocationButton,
  NetworkGlobeMap,
  NetworkMapView,
  NetworkMapViewToggle,
  CreateSpaceButton,
  SpaceCardList,
  SpaceSearch,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import { Text } from '@radix-ui/themes';
import { Combobox, Heading, Separator, Button } from '@hypha-platform/ui';
import React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cva } from 'class-variance-authority';
import { Clock } from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useFilterSpacesListWithDiscoverability } from '../hooks/use-spaces-discoverability-batch';

interface ExploreSpacesProps {
  lang: Locale;
  query?: string;
  spaces: Space[];
  categories?: Category[];
  order?: SpaceOrder;
  uniqueCategories: Category[];
  enableNetworkMap?: boolean;
}

const categoriesIntersected = (
  categories1: Category[],
  categories2: Category[],
) => categories1.some((category) => categories2.includes(category));

function toLowerHex<A extends `0x${string}`>(a: A): Lowercase<A> {
  return a.toLowerCase() as Lowercase<A>;
}

const CategoryLabel = ({
  selectedSpaces,
  categories,
  allLabel,
  className,
}: {
  selectedSpaces: Space[];
  categories?: Category[];
  allLabel: string;
  className?: string | undefined;
}) => {
  return (
    <Text className={cn('text-4 text-left', className)}>
      {categories && categories.length > 0 ? (
        <Text className="text-4 text-left">
          {categories.map((category, index) => {
            const label =
              categoryOptions.find((option) => option.value === category)
                ?.label ?? category;
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
          <Text className="text-4 ml-1 capitalize">{allLabel}</Text>
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
  enableNetworkMap = false,
}: ExploreSpacesProps) {
  const t = useTranslations('Network');
  const tCommon = useTranslations('Common');

  const orderOptions: {
    value: SpaceOrder;
    label: string;
    searchText: string;
  }[] = [
    {
      value: 'mostmembers',
      label: t('mostMembers'),
      searchText: t('mostMembers'),
    },
    {
      value: 'mostagreements',
      label: t('mostAgreements'),
      searchText: t('mostAgreements'),
    },
    {
      value: 'mostrecent',
      label: t('mostRecent'),
      searchText: t('mostRecent'),
    },
  ];

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

  const nonArchivedSpaces = React.useMemo(
    () => spaces.filter((space) => !isSpaceArchived(space)),
    [spaces],
  );

  const categoryFilteredSpaces = React.useMemo(
    () =>
      categories && categories.length > 0
        ? nonArchivedSpaces.filter((space) =>
            categoriesIntersected(space.categories ?? [], categories),
          )
        : nonArchivedSpaces,
    [nonArchivedSpaces, categories],
  );

  const { filteredSpaces: selectedSpaces } =
    useFilterSpacesListWithDiscoverability({
      spaces: categoryFilteredSpaces,
      useGeneralState: true,
    });

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
    (nextCategories: Category[]) => {
      const params = new URLSearchParams(searchParams);
      if (nextCategories.length > 0) {
        params.set('category', nextCategories.join(','));
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

  const view: NetworkMapView =
    enableNetworkMap && searchParams.get('view') !== 'list' ? 'map' : 'list';

  const setView = React.useCallback(
    (nextView: NetworkMapView) => {
      const params = new URLSearchParams(searchParams);
      if (nextView === 'list') {
        params.set('view', 'list');
      } else {
        params.delete('view');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace],
  );

  const multiSelectVariants = cva(
    'rounded-md px-2 py-1 text-sm transition-colors duration-150',
    {
      variants: {
        variant: {
          default: 'text-neutral-11 hover:text-foreground',
          secondary: 'text-foreground font-medium',
          destructive: 'text-destructive',
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

  const mapSpaces = React.useMemo(
    () => sortedSpaces.filter(hasSpaceMapLocation),
    [sortedSpaces],
  );

  const { isAuthenticated } = useAuthentication();

  const renderMapToolbar = React.useCallback(
    (layerControls: React.ReactNode) => (
      <div className="mb-4 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 w-full sm:flex-1">{layerControls}</div>
        <NetworkAddLocationButton
          lang={lang}
          spaces={spaces}
          isAuthenticated={isAuthenticated}
          className="h-9 shrink-0 px-2.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
        />
      </div>
    ),
    [lang, spaces, isAuthenticated],
  );

  const categoryFilters = (
    <div className="flex flex-wrap justify-center gap-2">
      {tags.map((tag) => (
        <button
          key={tag.value}
          type="button"
          aria-pressed={categories?.includes(tag.value) ?? false}
          className={cn(
            multiSelectVariants({
              variant: categories?.includes(tag.value)
                ? 'secondary'
                : 'default',
            }),
          )}
          onClick={() => {
            const newCategories = categories?.includes(tag.value)
              ? []
              : [tag.value];
            setCategories(newCategories);
          }}
        >
          {tag.label}
        </button>
      ))}
    </div>
  );

  const searchActionsRow = (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <SpaceSearch value={query} className="w-full min-w-0 sm:flex-1" />
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          className={cn(
            'h-9 shrink-0 gap-1.5 px-2.5 text-xs sm:h-10 sm:px-4 sm:text-sm',
            order === 'mostrecent' && 'border-accent-9 text-accent-11',
          )}
          aria-pressed={order === 'mostrecent'}
          onClick={() => setOrder('mostrecent')}
        >
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {t('mostRecent')}
        </Button>
        <CreateSpaceButton
          lang={lang}
          isAuthenticated={isAuthenticated}
          className="shrink-0"
          buttonClassName="h-9 gap-1.5 px-2.5 text-xs sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
        />
        {enableNetworkMap ? (
          <NetworkMapViewToggle
            value={view}
            onChange={setView}
            className="ml-auto shrink-0 sm:ml-0"
          />
        ) : null}
      </div>
    </div>
  );

  const sharedHeader = (
    <div className="mb-6 flex flex-col gap-4">
      {searchActionsRow}
      {categoryFilters}
    </div>
  );

  const listMetaRow = (
    <div className="mb-4 flex w-full flex-row items-center gap-2">
      <CategoryLabel
        selectedSpaces={selectedSpaces}
        categories={categories}
        allLabel={t('all')}
        className="flex grow"
      />
      <div className="flex shrink-0 flex-col">
        <Combobox
          options={orderOptions}
          initialValue={order}
          className="border-0 md:w-40"
          onChange={setOrder}
          allowEmptyChoice={false}
        />
      </div>
    </div>
  );

  const metricsSection = (
    <div className="flex items-stretch justify-center gap-0">
      <div className="flex min-w-[7rem] flex-col px-6 sm:min-w-[9rem] sm:px-10">
        <div className="flex justify-center text-7 font-medium">
          {selectedSpaces.length}
        </div>
        <div className="mt-2 flex justify-center text-1 text-neutral-500">
          {tCommon('Spaces')}
        </div>
      </div>
      <Separator orientation="vertical" className="bg-neutral-6" />
      <div className="flex min-w-[7rem] flex-col px-6 sm:min-w-[9rem] sm:px-10">
        <div className="flex justify-center text-7 font-medium">
          {uniqueMemberAddresses.size}
        </div>
        <div className="mt-2 flex justify-center text-1 text-neutral-500">
          {tCommon('Members')}
        </div>
      </div>
      <Separator orientation="vertical" className="bg-neutral-6" />
      <div className="flex min-w-[7rem] flex-col px-6 sm:min-w-[9rem] sm:px-10">
        <div className="flex justify-center text-7 font-medium">
          {agreementCount}
        </div>
        <div className="mt-2 flex justify-center text-1 text-neutral-500">
          {tCommon('Agreements')}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col">
      <Heading
        size="9"
        color="secondary"
        weight="medium"
        align="center"
        className="mb-8 flex flex-col"
      >
        <span>{t('manySpaces')}</span>
        <span>{t('oneVibrantNetwork')}</span>
      </Heading>

      {sharedHeader}

      {enableNetworkMap ? (
        view === 'map' ? (
          <NetworkGlobeMap
            lang={lang}
            spaces={mapSpaces}
            className="w-full"
            renderToolbar={renderMapToolbar}
          />
        ) : (
          <div className="flex w-full flex-col">
            {listMetaRow}
            <SpaceCardList
              lang={lang}
              spaces={sortedSpaces}
              pageSize={12}
              cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
            />
          </div>
        )
      ) : null}

      {enableNetworkMap && view === 'map' ? (
        <div className="mt-8">{metricsSection}</div>
      ) : null}

      {!enableNetworkMap ? (
        <>
          {listMetaRow}
          <SpaceCardList
            lang={lang}
            spaces={sortedSpaces}
            pageSize={12}
            cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          />
        </>
      ) : null}

      {enableNetworkMap && view === 'list' ? (
        <div className="mt-8">{metricsSection}</div>
      ) : null}
    </div>
  );
}
