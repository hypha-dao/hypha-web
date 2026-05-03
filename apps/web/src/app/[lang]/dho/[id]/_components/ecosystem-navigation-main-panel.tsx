'use client';

import Link from 'next/link';
import {
  Space,
  isSpaceArchived,
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  useFilterSpacesListWithDiscoverability,
  EcosystemNavigationShell,
  getDhoSpaceContextPath,
} from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SpaceVisualization } from './space-visualization';
import type { VisibleSpace } from './types';

type EcosystemNavigationMainPanelProps = {
  daoSlug: string;
  lang: Locale;
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
    value,
    children: childrenNodes.length > 0 ? childrenNodes : undefined,
  };
}

export function EcosystemNavigationMainPanel({
  daoSlug,
  lang,
}: EcosystemNavigationMainPanelProps) {
  const t = useTranslations('SelectNavigationAction');
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('nested-spaces');
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
  const currentSpaceTitle = currentSpace?.title ?? daoSlug;
  const currentSpaceSlug = currentSpace?.slug ?? daoSlug;
  const [selectedSpace, setSelectedSpace] = useState<VisibleSpace | null>(null);
  const ecosystemSpaceCount = useMemo(() => {
    if (!currentSpace) return 0;
    const spacesWithCurrent = nonArchivedSpaces.some(
      (s) => s.id === currentSpace.id,
    )
      ? nonArchivedSpaces
      : [...nonArchivedSpaces, currentSpace];
    return spacesWithCurrent.length;
  }, [currentSpace, nonArchivedSpaces]);

  useEffect(() => {
    setSelectedSpace({
      id: currentSpace?.id ?? -1,
      name: currentSpaceTitle,
      slug: currentSpaceSlug,
      logoUrl: currentSpace?.logoUrl,
      parentId: currentSpace?.parentId ?? null,
      root: true,
    });
  }, [
    currentSpace?.id,
    currentSpace?.logoUrl,
    currentSpace?.parentId,
    currentSpaceSlug,
    currentSpaceTitle,
  ]);

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

  const handleVisibleSpacesChange = useCallback(
    (visibleSpaces: VisibleSpace[]) => {
      setSelectedSpace((previous) => {
        const nextSelection = visibleSpaces[0];
        if (!nextSelection?.slug) {
          return previous;
        }

        if (
          previous?.id === nextSelection.id &&
          previous.slug === nextSelection.slug &&
          previous.name === nextSelection.name
        ) {
          return previous;
        }

        return nextSelection;
      });
    },
    [],
  );

  const tabs = useMemo(
    () => [
      {
        value: 'nested-spaces',
        label: t('tabs.nestedSpaces'),
        content: (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="w-full overflow-visible px-3 py-2 sm:px-5 sm:py-4">
              {hierarchyData ? (
                <div className="mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-16rem))]">
                  <SpaceVisualization
                    data={hierarchyData}
                    currentSpaceId={currentSpace?.id}
                    enableHoverActions={false}
                    onVisibleSpacesChange={handleVisibleSpacesChange}
                  />
                </div>
              ) : (
                <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
                  {t('comingSoon.spaceToSpaceVisualization')}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        value: 'space-to-space',
        label: t('tabs.spaceToSpace'),
        content: (
          <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-border/70 bg-background-3/70 text-sm text-muted-foreground">
            {t('comingSoon.spaceToSpaceVisualization')}
          </div>
        ),
      },
      {
        value: 'values-flows',
        label: t('tabs.valuesFlows'),
        content: (
          <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-border/70 bg-background-3/70 text-sm text-muted-foreground">
            {t('comingSoon.valuesFlowsVisualization')}
          </div>
        ),
      },
    ],
    [currentSpace?.id, handleVisibleSpacesChange, hierarchyData, t],
  );
  const selectedSpaceTitle = selectedSpace?.name ?? currentSpaceTitle;
  const selectedSpaceSlug = selectedSpace?.slug ?? currentSpaceSlug;
  const visitSpaceHref = getDhoSpaceContextPath({
    pathname,
    lang,
    spaceSlug: selectedSpaceSlug,
  });
  const addSpaceHref = `/${lang}/dho/${selectedSpaceSlug}/space/create`;

  return (
    <section className="flex w-full flex-col gap-4 py-4">
      {isLoading ? (
        <div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-border/60 bg-background-2 text-sm text-muted-foreground">
          {t('title')}
        </div>
      ) : (
        <EcosystemNavigationShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
          beforeTabsContent={
            <h1 className="text-7 font-semibold tracking-tight text-foreground">
              Ecosystem
              <span className="ml-2 text-5 font-medium text-muted-foreground">
                | {Intl.NumberFormat().format(ecosystemSpaceCount)}
              </span>
            </h1>
          }
          className={
            resolvedTheme === 'dark' ? 'bg-background-2' : 'bg-neutral-2/85'
          }
          visualizationClassName="min-h-0"
          afterTabsContent={
            <div className="w-full">
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div className="hidden xl:block" aria-hidden />
                <div className="min-w-0 text-center text-4 font-semibold tracking-tight text-foreground xl:justify-self-center">
                  {selectedSpaceTitle}
                </div>
                <div className="flex items-center justify-self-end gap-2">
                  <Link href={visitSpaceHref}>
                    <Button variant="outline" colorVariant="neutral">
                      {t('visibleSpaces.visitSpace')}
                    </Button>
                  </Link>
                  <Link href={addSpaceHref}>
                    <Button variant="default" colorVariant="accent">
                      {t('visibleSpaces.addSpace')}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          }
        />
      )}
    </section>
  );
}
