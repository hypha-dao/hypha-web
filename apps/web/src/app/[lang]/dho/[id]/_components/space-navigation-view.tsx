'use client';

import dynamic from 'next/dynamic';
import { SelectAction } from '@hypha-platform/epics';
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
import { useTheme } from 'next-themes';
import type { VisibleSpace } from './types';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

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
  const { resolvedTheme } = useTheme();
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
    const spacesKey = JSON.stringify(spaces.map((s) => s.id).sort());
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

  return (
    <section
      className="min-w-0"
      data-testid="dho-space-navigation-view"
      aria-label={t('title')}
    >
      <SelectAction
        title={t('title')}
        content={t('content')}
        showTitle
        showActionCards={false}
        actions={[]}
        isLoading={isLoading}
        className="!gap-3"
      >
        {children}
        <div className="mt-1" data-testid="dho-space-nav-map-tabs">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div
              className={cn(
                'sticky top-0 z-10 flex w-full justify-center border-b border-border/60 py-2 backdrop-blur-md',
                resolvedTheme === 'dark'
                  ? 'bg-background/80'
                  : 'bg-background/90',
              )}
            >
              <TabsList triggerVariant="switch">
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
            <TabsContent
              value="nested-spaces"
              className="mt-0 pt-0 focus-visible:outline-none"
            >
              <div
                className="relative -mx-3 min-h-[min(90dvh,1200px)] w-[calc(100%+1.5rem)] sm:-mx-4 sm:w-[calc(100%+2rem)]"
                data-testid="dho-space-nav-map"
              >
                <div
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                  aria-hidden
                >
                  <div
                    className="absolute -inset-[20%] opacity-40 dark:opacity-30 motion-reduce:animate-none"
                    style={{
                      background:
                        resolvedTheme === 'dark'
                          ? 'radial-gradient(ellipse 80% 50% at 50% 40%, hsl(var(--accent) / 0.12), transparent 60%), radial-gradient(ellipse 60% 40% at 20% 80%, hsl(var(--primary) / 0.08), transparent 50%)'
                          : 'radial-gradient(ellipse 80% 50% at 50% 30%, hsl(var(--accent) / 0.08), transparent 55%)',
                    }}
                  />
                </div>
                <div className="relative z-[1] flex min-h-0 w-full min-w-0 flex-col gap-3 px-1 pb-3 sm:px-2 lg:h-[min(90dvh,1200px)] lg:flex-row lg:gap-4">
                  {isLoading ? (
                    <div className="order-1 flex min-h-[min(40dvh,500px)] w-full flex-1 flex-col gap-2 lg:order-2">
                      <Skeleton
                        className="min-h-32 w-full flex-1 rounded-md"
                        loading
                        height="100%"
                      />
                      <Skeleton
                        className="h-10 w-full rounded-md"
                        loading
                        height="2.5rem"
                      />
                    </div>
                  ) : null}
                  {!isLoading && hierarchyData ? (
                    <div
                      className="relative order-2 flex min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-hidden border border-border/20 lg:order-1 lg:min-h-0 lg:flex-[1.65]"
                      style={{
                        minHeight: 'min(50dvh, 80vw)',
                        boxShadow: 'inset 0 0 80px hsl(0 0% 0% / 0.12)',
                      }}
                      aria-label={t('mapRegionAriaLabel')}
                    >
                      <SpaceVisualization
                        data={hierarchyData}
                        currentSpaceId={currentSpace?.id}
                        onVisibleSpacesChange={handleVisibleSpacesChange}
                        className="!flex h-full w-full"
                      />
                    </div>
                  ) : null}
                  {!isLoading && hierarchyData
                    ? visibleSpaces.length > 0 &&
                      nonArchivedSpaces.length > 0 && (
                        <div
                          className="order-1 flex w-full min-w-0 max-w-full flex-col border-t border-border/40 bg-background/90 py-2 backdrop-blur-sm lg:order-2 lg:min-h-0 lg:max-w-[40%] lg:shrink-0 lg:border-l lg:border-t-0"
                          style={{ minHeight: 'min(40dvh, 520px)' }}
                          aria-label={t('dataPanelAriaLabel')}
                        >
                          <VisibleSpacesList
                            visibleSpaces={visibleSpaces}
                            allSpaces={nonArchivedSpaces}
                            lang={lang}
                            entrySpaceId={currentSpace?.id}
                            variant="ecosystemPanel"
                            className="pl-0 sm:pl-1"
                          />
                        </div>
                      )
                    : null}
                </div>
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
      </SelectAction>
    </section>
  );
};
