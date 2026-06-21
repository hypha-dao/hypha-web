'use client';

import {
  CategoryGroupId,
  Space,
  SpaceOrder,
  CATEGORY_GROUPS,
  getCategoryGroupLabel,
  hasSpaceMapLocation,
  isSpaceArchived,
  spaceMatchesCategoryGroups,
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
import { Badge, Combobox, Heading, Separator } from '@hypha-platform/ui';
import React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cva } from 'class-variance-authority';
import { useAuthentication } from '@hypha-platform/authentication';
import { useFilterSpacesListWithDiscoverability } from '../hooks/use-spaces-discoverability-batch';

interface ExploreSpacesProps {
  lang: Locale;
  query?: string;
  spaces: Space[];
  categoryGroups?: CategoryGroupId[];
  order?: SpaceOrder;
  uniqueCategoryGroups: CategoryGroupId[];
  enableNetworkMap?: boolean;
}

function toLowerHex<A extends `0x${string}`>(a: A): Lowercase<A> {
  return a.toLowerCase() as Lowercase<A>;
}

const CategoryLabel = ({
  selectedSpaces,
  categoryGroups,
  allLabel,
  className,
}: {
  selectedSpaces: Space[];
  categoryGroups?: CategoryGroupId[];
  allLabel: string;
  className?: string | undefined;
}) => {
  return (
    <Text className={cn('text-4 text-left', className)}>
      {categoryGroups && categoryGroups.length > 0 ? (
        <Text className="text-4 text-left">
          {categoryGroups.map((groupId, index) => (
            <Text key={`cat-title-${groupId}`} className="text-4 ml-1">
              {index !== 0 && ' | '}
              {getCategoryGroupLabel(groupId)}
            </Text>
          ))}{' '}
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
  categoryGroups,
  order,
  uniqueCategoryGroups,
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
      categoryGroups && categoryGroups.length > 0
        ? nonArchivedSpaces.filter((space) =>
            spaceMatchesCategoryGroups(space.categories, categoryGroups),
          )
        : nonArchivedSpaces,
    [nonArchivedSpaces, categoryGroups],
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
      CATEGORY_GROUPS.filter((group) =>
        uniqueCategoryGroups.includes(group.id),
      ).sort((a, b) => (a.label > b.label ? 1 : -1)),
    [uniqueCategoryGroups],
  );

  const setCategoryGroups = React.useCallback(
    (nextCategoryGroups: CategoryGroupId[]) => {
      const params = new URLSearchParams(searchParams);
      if (nextCategoryGroups.length > 0) {
        params.set('category', nextCategoryGroups.join(','));
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

  const view: NetworkMapView = enableNetworkMap
    ? searchParams.get('view') === 'list'
      ? 'list'
      : 'map'
    : 'list';

  const setView = React.useCallback(
    (nextView: NetworkMapView) => {
      const params = new URLSearchParams(searchParams);
      if (nextView === 'list') {
        params.set('view', 'list');
      } else {
        params.set('view', 'map');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace],
  );

  const multiSelectVariants = cva(
    'transition ease-in-out delay-150 duration-300 max-sm:hover:translate-y-0 max-sm:hover:scale-100 sm:hover:-translate-y-1 sm:hover:scale-110',
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

  const mapSpaces = React.useMemo(
    () => selectedSpaces.filter(hasSpaceMapLocation),
    [selectedSpaces],
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
          className="h-9 w-full shrink-0 px-2.5 text-xs sm:h-10 sm:w-auto sm:px-4 sm:text-sm"
        />
      </div>
    ),
    [lang, spaces, isAuthenticated],
  );

  const categoryFilters = (
    <div className="mx-auto flex w-full max-w-xl flex-wrap justify-center gap-2">
      {tags.map((tag) => {
        const isSelected = categoryGroups?.includes(tag.id) ?? false;
        return (
          <Badge
            key={tag.id}
            className={cn(
              'shrink-0',
              multiSelectVariants({
                variant: isSelected ? 'secondary' : 'default',
              }),
            )}
            style={{ cursor: 'pointer', animationDuration: '0s' }}
            onClick={() => {
              const nextCategoryGroups = isSelected ? [] : [tag.id];
              setCategoryGroups(nextCategoryGroups);
            }}
          >
            {tag.label}
          </Badge>
        );
      })}
    </div>
  );

  const searchActionsRow = (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <SpaceSearch value={query} className="w-full min-w-0" />
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        {enableNetworkMap ? (
          <NetworkMapViewToggle
            value={view}
            onChange={setView}
            className="shrink-0"
          />
        ) : null}
        <div
          className={cn(
            'flex w-full min-w-0 items-stretch gap-2',
            enableNetworkMap && 'sm:ml-auto sm:w-auto',
          )}
        >
          {!enableNetworkMap || view === 'list' ? (
            <Combobox
              options={orderOptions}
              initialValue={order}
              className="h-9 min-w-0 flex-1 border-0 sm:w-40 sm:flex-none"
              onChange={setOrder}
              allowEmptyChoice={false}
            />
          ) : null}
          <CreateSpaceButton
            lang={lang}
            isAuthenticated={isAuthenticated}
            className="min-w-0 shrink-0"
            buttonClassName="h-9 gap-1.5 px-2.5 text-xs whitespace-nowrap sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
          />
        </div>
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
        categoryGroups={categoryGroups}
        allLabel={t('all')}
        className="flex grow"
      />
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
      <Separator
        orientation="vertical"
        className="h-auto self-stretch bg-neutral-6"
      />
      <div className="flex min-w-[7rem] flex-col px-6 sm:min-w-[9rem] sm:px-10">
        <div className="flex justify-center text-7 font-medium">
          {uniqueMemberAddresses.size}
        </div>
        <div className="mt-2 flex justify-center text-1 text-neutral-500">
          {tCommon('Members')}
        </div>
      </div>
      <Separator
        orientation="vertical"
        className="h-auto self-stretch bg-neutral-6"
      />
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
        className="mb-6 flex flex-col sm:mb-8"
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
