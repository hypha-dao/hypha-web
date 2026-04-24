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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@hypha-platform/ui';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import type { VisibleSpace } from './types';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

function SpaceMapLoadingPlaceholder() {
  const t = useTranslations('DhoWorkspaceNav');
  return (
    <div
      className="mx-auto min-h-[min(70vw,700px)] w-full max-w-[900px] rounded-lg bg-muted/80 p-4 animate-pulse"
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
    <section className="min-w-0" data-testid="dho-space-navigation-view">
      <SelectAction
        title={t('title')}
        content={t('content')}
        showTitle
        showActionCards={false}
        actions={[]}
        isLoading={isLoading}
        className="!gap-4"
      >
        {children}
        <div className="mt-2" data-testid="dho-space-nav-map-tabs">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={`w-full p-4 rounded-[6px] ${
              resolvedTheme === 'dark'
                ? 'bg-primary-foreground'
                : 'bg-neutral-3'
            }`}
          >
            <div className="w-full flex justify-center">
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
            <TabsContent value="nested-spaces" className="mt-4">
              <div
                className="flex flex-col gap-6"
                data-testid="dho-space-nav-map"
              >
                {hierarchyData && (
                  <SpaceVisualization
                    data={hierarchyData}
                    currentSpaceId={currentSpace?.id}
                    onVisibleSpacesChange={handleVisibleSpacesChange}
                  />
                )}
                {visibleSpaces.length > 0 && nonArchivedSpaces.length > 0 && (
                  <VisibleSpacesList
                    visibleSpaces={visibleSpaces}
                    allSpaces={nonArchivedSpaces}
                    lang={lang}
                    entrySpaceId={currentSpace?.id}
                  />
                )}
              </div>
            </TabsContent>
            <TabsContent value="space-to-space" className="mt-4">
              <div className="text-center text-neutral-11 py-8">
                {t('comingSoon.spaceToSpaceVisualization')}
              </div>
            </TabsContent>
            <TabsContent value="values-flows" className="mt-4">
              <div className="text-center text-neutral-11 py-8">
                {t('comingSoon.valuesFlowsVisualization')}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SelectAction>
    </section>
  );
};
