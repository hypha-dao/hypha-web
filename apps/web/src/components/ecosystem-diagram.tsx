'use client';

import { useMemo } from 'react';
import {
  Space,
  isSpaceArchived,
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

import { SpaceVisualization } from '@web/app/[lang]/dho/[id]/_components/space-visualization';

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
  const spaces = Array.isArray(allSpaces) ? allSpaces : [];
  const seen = new Set<number>();

  while (current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = spaces.find((item) => item.id === current.parentId);
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
  const childrenNodes = children.map((child) =>
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

export function EcosystemDiagram({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('SelectNavigationAction');
  const { space: currentSpace, isLoading: isLoadingSpace } =
    useSpaceBySlug(spaceSlug);
  const { spaces: allSpaces, isLoading: isLoadingSpaces } =
    useOrganisationSpacesBySingleSlug(spaceSlug);
  const { filteredSpaces, isLoading: isFilteringSpaces } =
    useFilterSpacesListWithDiscoverability({
      spaces: allSpaces || [],
      useGeneralState: true,
    });

  const nonArchivedSpaces = useMemo(
    () => (filteredSpaces ?? []).filter((space) => !isSpaceArchived(space)),
    [filteredSpaces],
  );
  const isLoading = isLoadingSpace || isLoadingSpaces || isFilteringSpaces;

  const hierarchy = useMemo(() => {
    if (!currentSpace || !filteredSpaces) return null;
    const spacesWithCurrent = nonArchivedSpaces.some(
      (space) => space.id === currentSpace.id,
    )
      ? nonArchivedSpaces
      : [...nonArchivedSpaces, currentSpace];
    const accessibleSpaceIds = new Set(
      spacesWithCurrent.map((space) => space.id),
    );
    const rootSpace = findRootSpace(currentSpace, spacesWithCurrent);
    return buildHierarchy(rootSpace, spacesWithCurrent, accessibleSpaceIds);
  }, [currentSpace, filteredSpaces, nonArchivedSpaces]);

  if (isLoading && !hierarchy) {
    return <div className="aspect-square w-full bg-muted" aria-hidden />;
  }

  if (!hierarchy) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-8">
        <div className="craft-empty-mark" aria-hidden />
        <p className="craft-meta text-center">{t('diagram.empty')}</p>
      </div>
    );
  }

  return (
    <SpaceVisualization
      data={hierarchy}
      currentSpaceId={currentSpace?.id}
      enableHoverActions={false}
      showNodeLabels
      ariaLabel={t('diagram.ariaLabel')}
    />
  );
}
