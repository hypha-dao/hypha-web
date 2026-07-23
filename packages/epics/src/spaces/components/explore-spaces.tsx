'use client';

import {
  CategoryGroupId,
  Space,
  SpaceOrder,
  CATEGORY_GROUPS,
  getCategoryGroupLabel,
  hasSpaceMapLocation,
  isSpaceArchived,
  sortSpacesByOrder,
  spaceMatchesCategoryGroups,
} from '@hypha-platform/core/client';
import {
  NetworkAddLocationButton,
  NetworkGlobeMap,
  NetworkMapViewToggle,
  useNetworkGlobeReady,
  loadLandGeo,
  type NetworkMapView,
} from '../../network-map';
import { CreateSpaceButton } from './create-space-button';
import { NetworkLoadingGrid } from './network-loading-grid';
import { SpaceCardList } from './space-card-list';
import { SpaceSearch } from './space-search';
import { SpaceOrderCombobox } from './space-order-combobox';
import { spaceToolbarPrimaryButtonClassName } from './space-toolbar-styles';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import { Text } from '@radix-ui/themes';
import { Badge, Heading, Separator, Skeleton } from '@hypha-platform/ui';
import React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthentication } from '@hypha-platform/authentication';
import { useFilterSpacesListWithDiscoverability } from '../hooks/use-spaces-discoverability-batch';
import { readClientSearchParams } from '../read-client-search-params';

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

const CountValue = ({
  value,
  isLoading,
  width = 24,
}: {
  value: number;
  isLoading?: boolean;
  width?: number;
}) => {
  if (isLoading) {
    return (
      <Skeleton
        loading
        width={width}
        height={16}
        className="inline-block align-middle"
      />
    );
  }
  return <>{value}</>;
};

const CategoryLabel = ({
  selectedSpaces,
  categoryGroups,
  allLabel,
  className,
  isLoading,
}: {
  selectedSpaces: Space[];
  categoryGroups?: CategoryGroupId[];
  allLabel: string;
  className?: string | undefined;
  isLoading?: boolean;
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
          <CountValue
            value={selectedSpaces?.length ?? 0}
            isLoading={isLoading}
          />
        </Text>
      ) : (
        <Text className="text-4 text-left">
          <Text className="text-4 ml-1 capitalize">{allLabel}</Text>
          <Text className="text-4 ml-1 mr-1">|</Text>
          <CountValue
            value={selectedSpaces?.length ?? 0}
            isLoading={isLoading}
          />
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

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const globeReady = useNetworkGlobeReady();

  React.useEffect(() => {
    if (enableNetworkMap) {
      void loadLandGeo();
    }
  }, [enableNetworkMap]);

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

  const { filteredSpaces: selectedSpaces, isLoading: isFilterLoading } =
    useFilterSpacesListWithDiscoverability({
      spaces: categoryFilteredSpaces,
      useGeneralState: true,
      excludeSpaceLevelFromNetwork: true,
    });

  // Discoverability is resolved on-chain, so the filtered set (and therefore the
  // total count) starts as "all spaces" and shrinks as the batch resolves, which
  // made the list visibly reorder and the counts flicker on first load. Gate the
  // list + counts on a settle-once flag so we show a stable skeleton until the
  // filter has resolved a single time, then keep the final set. Rendering the
  // skeleton on the server too avoids an SSR -> skeleton flash.
  const [hasSettledFilter, setHasSettledFilter] = React.useState(false);
  React.useEffect(() => {
    if (!isFilterLoading) {
      setHasSettledFilter(true);
    }
  }, [isFilterLoading]);
  const showSpacesSkeleton = !hasSettledFilter;

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
      const params = readClientSearchParams(searchParams);
      if (nextCategoryGroups.length > 0) {
        params.set('category', nextCategoryGroups.join(','));
      } else {
        params.delete('category');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace],
  );

  const viewFromUrl = (params: URLSearchParams): NetworkMapView =>
    params.get('view') === 'map' ? 'map' : 'list';

  const [view, setViewState] = React.useState<NetworkMapView>(() =>
    enableNetworkMap ? viewFromUrl(searchParams) : 'list',
  );

  React.useEffect(() => {
    if (!enableNetworkMap) {
      return;
    }

    const onPopState = () => {
      setViewState(viewFromUrl(new URLSearchParams(window.location.search)));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enableNetworkMap]);

  const setView = React.useCallback(
    (nextView: NetworkMapView) => {
      setViewState(nextView);

      const params = new URLSearchParams(window.location.search);
      if (nextView === 'list') {
        params.set('view', 'list');
      } else {
        params.set('view', 'map');
      }
      const queryString = params.toString();
      window.history.replaceState(
        window.history.state,
        '',
        `${pathname}${queryString ? `?${queryString}` : ''}`,
      );
    },
    [pathname],
  );

  const sortedSpaces = React.useMemo(
    () => sortSpacesByOrder(selectedSpaces, order ?? 'mostmembers'),
    [selectedSpaces, order],
  );

  const mapSpaces = React.useMemo(
    () => selectedSpaces.filter(hasSpaceMapLocation),
    [selectedSpaces],
  );

  const cardGridClassName = 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';
  const spacesListContent = showSpacesSkeleton ? (
    <NetworkLoadingGrid count={12} cardGridClassName={cardGridClassName} />
  ) : (
    <SpaceCardList
      lang={lang}
      spaces={sortedSpaces}
      pageSize={12}
      cardGridClassName={cardGridClassName}
    />
  );

  const { isAuthenticated } = useAuthentication();

  const renderMapToolbar = React.useCallback(
    (layerControls: React.ReactNode) => (
      <div className="mb-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
        <div className="min-w-0 w-full sm:flex-1">{layerControls}</div>
        <NetworkAddLocationButton
          lang={lang}
          spaces={spaces}
          isAuthenticated={isAuthenticated}
          className={cn(
            spaceToolbarPrimaryButtonClassName,
            'w-fit shrink-0 self-start border-border bg-background shadow-none hover:bg-muted/15 sm:self-auto',
          )}
        />
      </div>
    ),
    [lang, spaces, isAuthenticated],
  );

  const categoryFilters = (
    <div className="flex flex-wrap justify-center gap-2">
      {tags.map((tag) => {
        const isSelected = categoryGroups?.includes(tag.id) ?? false;
        return (
          <Badge
            key={tag.id}
            variant="outline"
            colorVariant={isSelected ? 'accent' : 'neutral'}
            size={1}
            className={cn(
              'craft-chip craft-chip-interactive shrink-0 cursor-pointer',
              isSelected &&
                'border-accent-8/55 bg-accent-2/35 text-foreground hover:bg-accent-3/40',
            )}
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

  const showSortControl = !enableNetworkMap || view === 'list';
  const deferBelowMapContent =
    enableNetworkMap && view === 'map' && !globeReady;

  const searchActionsRow = (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {enableNetworkMap ? (
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex w-full min-w-0 flex-row items-center gap-3 sm:contents">
            <SpaceSearch value={query} className="min-w-0 flex-1" />
            <CreateSpaceButton
              lang={lang}
              isAuthenticated={isAuthenticated}
              className="min-w-0 shrink-0 sm:ml-auto"
              buttonClassName={spaceToolbarPrimaryButtonClassName}
            />
          </div>
          <NetworkMapViewToggle
            value={view}
            onChange={setView}
            className="w-fit max-w-full shrink-0"
          />
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-row items-center gap-3">
          <SpaceSearch value={query} className="min-w-0 flex-1" />
          <CreateSpaceButton
            lang={lang}
            isAuthenticated={isAuthenticated}
            className="min-w-0 shrink-0 sm:ml-auto"
            buttonClassName={spaceToolbarPrimaryButtonClassName}
          />
        </div>
      )}
    </div>
  );

  const sharedHeader = (
    <div className="mb-6 flex flex-col gap-4">
      {searchActionsRow}
      {categoryFilters}
    </div>
  );

  const listMetaRow = (
    <div className="mb-4 flex w-full flex-row items-center justify-between gap-2">
      <CategoryLabel
        selectedSpaces={selectedSpaces}
        categoryGroups={categoryGroups}
        allLabel={t('all')}
        isLoading={showSpacesSkeleton}
      />
      {showSortControl ? <SpaceOrderCombobox order={order} /> : null}
    </div>
  );

  const metricsSection = (
    <div className="flex items-stretch justify-center gap-0">
      <div className="flex min-w-[7rem] flex-col px-6 sm:min-w-[9rem] sm:px-10">
        <div className="flex justify-center text-7 font-medium">
          <CountValue
            value={selectedSpaces.length}
            isLoading={showSpacesSkeleton}
            width={40}
          />
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
          <CountValue
            value={uniqueMemberAddresses.size}
            isLoading={showSpacesSkeleton}
            width={40}
          />
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
          <CountValue
            value={agreementCount}
            isLoading={showSpacesSkeleton}
            width={40}
          />
        </div>
        <div className="mt-2 flex justify-center text-1 text-neutral-500">
          {tCommon('Agreements')}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-9">
      <Heading
        size="9"
        color="secondary"
        weight="medium"
        align="center"
        className="flex flex-col"
      >
        <span>{t('manySpaces')}</span>
        <span>{t('oneVibrantNetwork')}</span>
      </Heading>

      <div className="flex min-w-0 flex-col">
        {sharedHeader}

        {enableNetworkMap ? (
          <>
            <div className={cn(view !== 'map' && 'hidden')}>
              <NetworkGlobeMap
                lang={lang}
                spaces={mapSpaces}
                className="w-full"
                renderToolbar={renderMapToolbar}
                isActive={view === 'map'}
              />
            </div>
            <div className={cn(view !== 'list' && 'hidden')}>
              {listMetaRow}
              {spacesListContent}
            </div>
            <div className={cn('mt-8', deferBelowMapContent && 'hidden')}>
              {metricsSection}
            </div>
          </>
        ) : (
          <>
            {listMetaRow}
            {spacesListContent}
          </>
        )}
      </div>
    </div>
  );
}
