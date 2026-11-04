'use client';

import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { MyceliumEcosystem } from './mycelium-ecosystem';
import { VisibleSpacesList } from './visible-spaces-list';
import {
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { Space } from '@hypha-platform/core/client';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Separator } from '@hypha-platform/ui';
import type { VisibleSpace } from './types';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

type SelectNavigationActionProps = {
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
  const spaces = Array.isArray(allSpaces) ? allSpaces : [];

  while (current.parentId) {
    const parent = spaces.find((s) => s.id === current.parentId);
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

export const SelectNavigationAction = ({
  daoSlug,
  lang,
  children,
}: SelectNavigationActionProps) => {
  const t = useTranslations('SelectNavigationAction');
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
    <SelectAction
      title={t('title')}
      content={t('content')}
      showTitle={false}
      actions={[]}
      isLoading={isLoading}
    >
      <Separator />
      {children}
      <div className="mt-2 flex h-[32rem] flex-col gap-6">
        {hierarchyData ? (
          <MyceliumEcosystem
            data={hierarchyData}
            currentSpaceId={currentSpace?.id}
            ariaLabel={t('diagram.ariaLabel')}
            onVisibleSpacesChange={handleVisibleSpacesChange}
          />
        ) : null}
        {visibleSpaces.length > 0 && nonArchivedSpaces.length > 0 ? (
          <VisibleSpacesList
            visibleSpaces={visibleSpaces}
            allSpaces={nonArchivedSpaces}
            lang={lang}
            entrySpaceId={currentSpace?.id}
          />
        ) : null}
      </div>
    </SelectAction>
  );
};
