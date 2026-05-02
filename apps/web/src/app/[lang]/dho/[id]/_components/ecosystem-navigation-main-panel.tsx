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
} from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { getDhoPathAgreements } from '../@tab/agreements/constants';
import { SpaceVisualization } from './space-visualization';

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
  const [selectedSpaceTitle, setSelectedSpaceTitle] =
    useState(currentSpaceTitle);

  useEffect(() => {
    setSelectedSpaceTitle(currentSpaceTitle);
  }, [currentSpaceTitle]);

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
                    onVisibleSpacesChange={(visibleSpaces) => {
                      setSelectedSpaceTitle(
                        visibleSpaces[0]?.name ?? currentSpaceTitle,
                      );
                    }}
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
    [currentSpace?.id, hierarchyData, lang, t],
  );
  const currentSpaceSlug = currentSpace?.slug ?? daoSlug;
  const visitSpaceHref = getDhoPathAgreements(lang, currentSpaceSlug);
  const addSpaceHref = `/${lang}/dho/${currentSpaceSlug}/space/create`;

  return (
    <section className="w-full py-0">
      {isLoading ? (
        <div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-border/60 bg-background-2 text-sm text-muted-foreground">
          {t('title')}
        </div>
      ) : (
        <EcosystemNavigationShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
          className={
            resolvedTheme === 'dark' ? 'bg-background-2' : 'bg-neutral-2/85'
          }
          visualizationClassName="min-h-0"
          afterTabsContent={
            <div className="w-full max-w-5xl pt-2">
              <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <div aria-hidden />
                <div className="text-center text-4 font-semibold tracking-tight text-foreground">
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
