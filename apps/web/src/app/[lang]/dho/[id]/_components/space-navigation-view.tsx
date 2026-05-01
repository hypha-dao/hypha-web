'use client';

import dynamic from 'next/dynamic';
import { Locale } from '@hypha-platform/i18n';
import { VisibleSpacesList } from './visible-spaces-list';
import {
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { Space } from '@hypha-platform/core/client';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { VisibleSpace } from './types';
import {
  DhoTabToolbarStack,
  useFilterSpacesListWithDiscoverability,
} from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

/** Map + side panel share one column template on lg+ (diagram ~3fr, list grows with ~2fr). */
const ECOSYSTEM_LG_GRID_COLS =
  'lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]' as const;

function SpaceMapLoadingPlaceholder() {
  const t = useTranslations('DhoWorkspaceNav');
  return (
    <div
      className="h-full min-h-48 w-full min-w-0 max-w-full flex-1 bg-muted/40 motion-safe:animate-pulse"
      role="status"
      aria-live="polite"
      aria-label={t('spaceMapLoading')}
    />
  );
}

const SpaceVisualization = dynamic(
  () =>
    import('./space-visualization').then((m) => ({
      default: m.SpaceVisualization,
    })),
  { ssr: false, loading: () => <SpaceMapLoadingPlaceholder /> },
);

type SpaceNavigationViewProps = {
  daoSlug: string;
  lang: Locale;
  children?: React.ReactNode;
};

type HierarchyNode = {
  name: string;
  logoUrl?: string | null;
  id: number;
  slug?: string;
  value?: number;
  children?: HierarchyNode[];
};

function findRootSpace(space: Space, allSpaces: Space[]): Space {
  let current = space;

  while (current.parentId) {
    const parent = allSpaces.find((s) => s.id === current.parentId);
    if (!parent) break;
    current = parent;
  }

  return current;
}

function buildHierarchy(
  currentSpace: Space,
  allSpaces: Space[],
  accessibleSpaceIds: Set<number>,
): HierarchyNode {
  const children = allSpaces.filter(
    (space) =>
      space.parentId === currentSpace.id && accessibleSpaceIds.has(space.id),
  );

  const childrenNodes: HierarchyNode[] = children.map((child) =>
    buildHierarchy(child, allSpaces, accessibleSpaceIds),
  );

  const value = currentSpace.memberCount || currentSpace.documentCount || 1;

  return {
    name: currentSpace.title,
    logoUrl: currentSpace.logoUrl,
    id: currentSpace.id,
    slug: currentSpace.slug,
    value: value,
    children: childrenNodes.length > 0 ? childrenNodes : undefined,
  };
}

export const SpaceNavigationView = ({
  daoSlug,
  lang,
  children,
}: SpaceNavigationViewProps) => {
  const t = useTranslations('SelectNavigationAction');
  const [activeTab, setActiveTab] = useState('nested-spaces');
  const [visibleSpaces, setVisibleSpaces] = useState<VisibleSpace[]>([]);
  const previousSpacesRef = useRef<string>('');
  const { space: currentSpace, isLoading: isLoadingSpace } =
    useSpaceBySlug(daoSlug);
  const { spaces: allSpaces, isLoading: isLoadingSpaces } =
    useOrganisationSpacesBySingleSlug(daoSlug);

  const { filteredSpaces, isLoading: isFilteringSpaces } =
    useFilterSpacesListWithDiscoverability({
      spaces: allSpaces || [],
      useGeneralState: true,
    });

  const nonArchivedSpaces = useMemo(
    () => (filteredSpaces ?? []).filter((s) => !isSpaceArchived(s)),
    [filteredSpaces],
  );

  const isLoading = isLoadingSpace || isLoadingSpaces || isFilteringSpaces;

  const hierarchyData: HierarchyNode | null = useMemo(() => {
    if (!currentSpace || !filteredSpaces) return null;

    const spacesWithCurrent = nonArchivedSpaces.some(
      (s) => s.id === currentSpace.id,
    )
      ? nonArchivedSpaces
      : [...nonArchivedSpaces, currentSpace];

    const accessibleSpaceIds = new Set(spacesWithCurrent.map((s) => s.id));

    const rootSpace = findRootSpace(currentSpace, spacesWithCurrent);
    if (!rootSpace) return null;
    return buildHierarchy(rootSpace, spacesWithCurrent, accessibleSpaceIds);
  }, [currentSpace, filteredSpaces, nonArchivedSpaces]);

  const handleVisibleSpacesChange = useCallback((spaces: VisibleSpace[]) => {
    const snapshot = [...spaces]
      .sort((a, b) => a.id - b.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        parentId: s.parentId,
        root: s.root,
      }));
    const spacesKey = JSON.stringify(snapshot);
    if (previousSpacesRef.current !== spacesKey) {
      previousSpacesRef.current = spacesKey;
      setVisibleSpaces(spaces);
    }
  }, []);

  const currentSpaceId = currentSpace?.id;
  const allSpacesLength = allSpaces?.length;
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    previousSpacesRef.current = '';
  }, [currentSpaceId, allSpacesLength]);

  const showSpacesPanel =
    !isLoading &&
    hierarchyData &&
    visibleSpaces.length > 0 &&
    nonArchivedSpaces.length > 0;

  return (
    <section
      className="min-w-0"
      data-testid="dho-space-navigation-view"
      aria-label={t('title')}
    >
      {children}
      <div className="w-full min-w-0" data-testid="dho-space-nav-map-tabs">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full min-w-0"
        >
          <DhoTabToolbarStack>
            {isLoading ? (
              <div className="flex min-h-11 w-full flex-wrap items-center gap-3">
                <Skeleton className="h-7 w-40" loading />
                <Skeleton className="h-9 flex-1 basis-48 sm:max-w-md" loading />
              </div>
            ) : (
              /*
                Align the tab strip with the right-hand “Spaces” panel on lg+: same grid column
                as cards (map lives in column 1). Mobile: stacked title + full-width tabs.
              */
              <div
                className={cn(
                  'flex w-full min-w-0 flex-col gap-3',
                  'lg:grid lg:items-center lg:gap-x-4',
                  ECOSYSTEM_LG_GRID_COLS,
                )}
              >
                <div className="flex min-h-8 min-w-0 shrink-0 items-center lg:col-start-1 lg:row-start-1">
                  <span className="text-4 capitalize leading-tight text-nowrap">
                    {t('title')}
                  </span>
                </div>
                <TabsList
                  triggerVariant="switch"
                  data-testid="dho-space-nav-ecosystem-tabs"
                  className={cn(
                    'inline-flex h-auto min-h-10 w-full min-w-0 flex-wrap justify-center gap-1 px-0.5',
                    'lg:col-start-2 lg:row-start-1 lg:w-full lg:justify-stretch lg:gap-0.5 lg:px-1',
                    /* Wrap when the panel column is still tight — avoids overlapping labels */
                    '[&>button]:min-h-9 [&>button]:min-w-[7.5rem] [&>button]:flex-1 [&>button]:basis-[min(100%,11rem)]',
                  )}
                >
                  <TabsTrigger variant="switch" value="nested-spaces">
                    {t('tabs.nestedSpaces')}
                  </TabsTrigger>
                  <TabsTrigger variant="switch" value="space-to-space">
                    {t('tabs.spaceToSpace')}
                  </TabsTrigger>
                  <TabsTrigger variant="switch" value="values-flows">
                    {t('tabs.valuesFlows')}
                  </TabsTrigger>
                </TabsList>
              </div>
            )}
          </DhoTabToolbarStack>

          <TabsContent
            value="nested-spaces"
            className="mt-0 min-h-0 min-w-0 focus-visible:outline-none"
          >
            {/* Map + list: cap height to the viewport so the D3 view fits at 100% zoom without
                forcing page scroll; list is a separate scrollport on lg. */}
            <div
              className={cn(
                'flex min-h-0 w-full min-w-0 flex-col gap-4',
                'lg:grid lg:max-h-[min(75dvh,calc(100dvh-9.5rem))] lg:items-stretch lg:gap-x-4 lg:gap-y-0',
                ECOSYSTEM_LG_GRID_COLS,
              )}
            >
              <div
                role="region"
                className={cn(
                  'relative order-1 flex w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-lg',
                  /* Neutral chrome only — accent shows on orbit/graph strokes, not the canvas */
                  'bg-muted/25 dark:bg-muted/15',
                  'aspect-square max-h-[min(72dvh,calc(100dvh-10rem),min(100vw,56rem))] max-w-full self-center',
                  'lg:col-start-1 lg:row-start-1 lg:aspect-auto lg:h-full lg:max-h-full lg:w-full lg:max-w-none lg:min-h-0 lg:self-stretch',
                  'shadow-[inset_0_0_72px_rgb(0_0_0/0.06)] dark:shadow-[inset_0_0_64px_rgb(0_0_0/0.45)]',
                )}
                aria-label={t('mapRegionAriaLabel')}
              >
                {isLoading ? (
                  <Skeleton
                    className="absolute inset-0 rounded-none"
                    loading
                    height="100%"
                  />
                ) : null}
                {!isLoading && hierarchyData ? (
                  <SpaceVisualization
                    data={hierarchyData}
                    currentSpaceId={currentSpace?.id}
                    onVisibleSpacesChange={handleVisibleSpacesChange}
                    className="!flex h-full w-full min-h-0"
                  />
                ) : null}
              </div>

              {showSpacesPanel ? (
                <div
                  role="region"
                  data-testid="dho-ecosystem-spaces-panel"
                  className={cn(
                    'order-2 flex min-h-0 w-full min-w-0 flex-col border-t border-border/50 pt-4',
                    'lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:w-full lg:min-w-0 lg:max-w-none lg:overflow-hidden lg:border-l lg:border-t-0 lg:pt-0',
                    'lg:pl-3',
                  )}
                  aria-label={t('dataPanelAriaLabel')}
                >
                  <VisibleSpacesList
                    visibleSpaces={visibleSpaces}
                    allSpaces={nonArchivedSpaces}
                    lang={lang}
                    entrySpaceId={currentSpace?.id}
                    variant="ecosystemPanel"
                    className="h-full min-h-0 pl-0 sm:pl-0.5"
                  />
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="space-to-space" className="mt-4 min-h-32">
            <div className="py-8 text-center text-neutral-11">
              {t('comingSoon.spaceToSpaceVisualization')}
            </div>
          </TabsContent>
          <TabsContent value="values-flows" className="mt-4 min-h-32">
            <div className="py-8 text-center text-neutral-11">
              {t('comingSoon.valuesFlowsVisualization')}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
