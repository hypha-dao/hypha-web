'use client';

import {
  Space,
  isSpaceArchived,
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  useCanMutateInSpace,
  useFilterSpacesListWithDiscoverability,
  EcosystemNavigationShell,
  getDhoSpaceContextPath,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useTheme } from 'next-themes';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { sampleAccentHex } from './space-accent-utils';
import type { VisibleSpace } from './types';
import { NestedSpacesView } from './ecosystem/nested-spaces-view';
import { MemberConnectionsView } from './ecosystem/member-connections-view';
import { SpaceToSpaceView } from './ecosystem/space-to-space-view';
import { ValueFlowsView } from './ecosystem/value-flows-view';
import type { HierarchyNode } from './ecosystem/types';

type EcosystemNavigationMainPanelProps = {
  daoSlug: string;
  lang: Locale;
};

const SELECTED_SPACE_ACCENT_FALLBACK = '#14b8a6';

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
    value,
    children: childrenNodes.length > 0 ? childrenNodes : undefined,
  };
}

function buildBreadcrumb(selected: Space | null, allSpaces: Space[]): string[] {
  if (!selected) return [];
  const titles: string[] = [selected.title];
  let current = selected;
  const spaces = Array.isArray(allSpaces) ? allSpaces : [];
  while (current.parentId) {
    const parent = spaces.find((s) => s.id === current.parentId);
    if (!parent) break;
    titles.unshift(parent.title);
    current = parent;
  }
  return titles;
}

export function EcosystemNavigationMainPanel({
  daoSlug,
  lang,
}: EcosystemNavigationMainPanelProps) {
  const t = useTranslations('SelectNavigationAction');
  const format = useFormatter();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('nested-spaces');
  const [selectedSpaceAccent, setSelectedSpaceAccent] = useState(
    SELECTED_SPACE_ACCENT_FALLBACK,
  );
  const [rootSpaceAccent, setRootSpaceAccent] = useState(
    SELECTED_SPACE_ACCENT_FALLBACK,
  );
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
  const currentSpaceTitle = currentSpace?.title ?? '';
  const currentSpaceSlug = currentSpace?.slug;
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
    if (!currentSpace || !currentSpaceSlug) {
      setSelectedSpace(null);
      return;
    }
    setSelectedSpace({
      id: currentSpace.id,
      name: currentSpace.title,
      slug: currentSpaceSlug,
      logoUrl: currentSpace.logoUrl,
      parentId: currentSpace.parentId ?? null,
      root: true,
    });
  }, [currentSpace, currentSpaceSlug]);

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
  const selectedSpaceTitle =
    selectedSpace?.name ?? currentSpaceTitle ?? t('title');
  const selectedSpaceSlug = selectedSpace?.slug ?? currentSpaceSlug ?? daoSlug;
  const selectedSpaceRecord = useMemo(() => {
    if (!currentSpace) return null;
    if (!selectedSpace?.id) return currentSpace;
    const spacesWithCurrent = nonArchivedSpaces.some(
      (s) => s.id === currentSpace.id,
    )
      ? nonArchivedSpaces
      : [...nonArchivedSpaces, currentSpace];
    return (
      spacesWithCurrent.find((space) => space.id === selectedSpace.id) ??
      currentSpace
    );
  }, [selectedSpace?.id, nonArchivedSpaces, currentSpace]);
  const { canMutate, isLoading: isMutateLoading } = useCanMutateInSpace({
    spaceSlug: selectedSpaceSlug,
    space: selectedSpaceRecord ?? currentSpace,
    spaceId: (selectedSpaceRecord ?? currentSpace)?.web3SpaceId ?? undefined,
  });
  const canAddSpace = Boolean(
    currentSpace && selectedSpaceSlug && !isMutateLoading && canMutate,
  );
  const visitSpaceHref = selectedSpaceSlug
    ? getDhoSpaceContextPath({
        pathname,
        lang,
        spaceSlug: selectedSpaceSlug,
      })
    : null;
  const canVisitSpace = Boolean(currentSpace && visitSpaceHref);
  const addSpaceHref =
    canAddSpace && visitSpaceHref ? `${visitSpaceHref}/space/create` : null;
  const rootSpaceRecord = useMemo(() => {
    if (!currentSpace) return null;
    const spacesWithCurrent = nonArchivedSpaces.some(
      (s) => s.id === currentSpace.id,
    )
      ? nonArchivedSpaces
      : [...nonArchivedSpaces, currentSpace];
    return findRootSpace(currentSpace, spacesWithCurrent);
  }, [currentSpace, nonArchivedSpaces]);

  const breadcrumbTitles = useMemo(
    () => buildBreadcrumb(selectedSpaceRecord, nonArchivedSpaces),
    [selectedSpaceRecord, nonArchivedSpaces],
  );

  const handleVisitSpaceSlug = useCallback(
    (slug: string) => {
      const href = getDhoSpaceContextPath({
        pathname,
        lang,
        spaceSlug: slug,
      });
      router.push(href);
    },
    [pathname, lang, router],
  );

  useEffect(() => {
    let cancelled = false;
    setSelectedSpaceAccent(SELECTED_SPACE_ACCENT_FALLBACK);
    void (async () => {
      const [logoAccent, leadAccent] = await Promise.all([
        sampleAccentHex(selectedSpaceRecord?.logoUrl),
        sampleAccentHex(selectedSpaceRecord?.leadImage),
      ]);
      if (cancelled) return;
      setSelectedSpaceAccent(
        logoAccent ?? leadAccent ?? SELECTED_SPACE_ACCENT_FALLBACK,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSpaceRecord?.logoUrl, selectedSpaceRecord?.leadImage]);
  useEffect(() => {
    let cancelled = false;
    setRootSpaceAccent(SELECTED_SPACE_ACCENT_FALLBACK);
    void (async () => {
      const [logoAccent, leadAccent] = await Promise.all([
        sampleAccentHex(rootSpaceRecord?.logoUrl),
        sampleAccentHex(rootSpaceRecord?.leadImage),
      ]);
      if (cancelled) return;
      setRootSpaceAccent(
        logoAccent ?? leadAccent ?? SELECTED_SPACE_ACCENT_FALLBACK,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [rootSpaceRecord?.logoUrl, rootSpaceRecord?.leadImage]);

  const tabs = useMemo(
    () => [
      {
        value: 'nested-spaces',
        label: t('tabs.nestedSpaces'),
        content: hierarchyData ? (
          <NestedSpacesView
            hierarchyData={hierarchyData}
            currentSpaceId={currentSpace?.id}
            rootAccentHex={rootSpaceAccent}
            selectedSpaceTitle={selectedSpaceTitle}
            selectedSpaceSlug={selectedSpaceSlug}
            selectedSpaceRecord={selectedSpaceRecord}
            selectedAccent={selectedSpaceAccent}
            breadcrumbTitles={breadcrumbTitles}
            visitHref={visitSpaceHref}
            addHref={addSpaceHref}
            canVisit={canVisitSpace}
            canAdd={canAddSpace}
            organisationSpaces={nonArchivedSpaces}
            onVisitSpace={handleVisitSpaceSlug}
            onVisibleSpacesChange={handleVisibleSpacesChange}
          />
        ) : (
          <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
            {t('visibleSpaces.spaceInfoNotAvailable')}
          </div>
        ),
      },
      {
        value: 'member-connections',
        label: t('tabs.memberConnections'),
        content: (
          <MemberConnectionsView
            spaceSlug={daoSlug}
            spaceTitle={currentSpaceTitle || t('ecosystem')}
            spaceLogoUrl={currentSpace?.logoUrl}
            organisationSpaces={nonArchivedSpaces}
            accentHex={selectedSpaceAccent}
            onVisitSpace={handleVisitSpaceSlug}
          />
        ),
      },
      {
        value: 'space-to-space',
        label: t('tabs.spaceToSpace'),
        content: (
          <SpaceToSpaceView
            spaceSlug={daoSlug}
            spaceTitle={currentSpaceTitle || t('ecosystem')}
            spaceLogoUrl={currentSpace?.logoUrl}
            organisationSpaces={nonArchivedSpaces}
            accentHex={selectedSpaceAccent}
            onVisitSpace={handleVisitSpaceSlug}
          />
        ),
      },
      {
        value: 'values-flows',
        label: t('tabs.valuesFlows'),
        content: (
          <ValueFlowsView
            spaceSlug={daoSlug}
            spaceTitle={currentSpaceTitle || t('ecosystem')}
            spaceLogoUrl={currentSpace?.logoUrl}
            accentHex={selectedSpaceAccent}
          />
        ),
      },
    ],
    [
      addSpaceHref,
      breadcrumbTitles,
      canAddSpace,
      canVisitSpace,
      currentSpace?.id,
      currentSpace?.logoUrl,
      currentSpaceTitle,
      daoSlug,
      handleVisitSpaceSlug,
      handleVisibleSpacesChange,
      hierarchyData,
      nonArchivedSpaces,
      rootSpaceAccent,
      selectedSpaceAccent,
      selectedSpaceRecord,
      selectedSpaceSlug,
      selectedSpaceTitle,
      t,
      visitSpaceHref,
    ],
  );

  return (
    <section className="flex w-full flex-col gap-4 py-4">
      {isLoading ? null : (
        <EcosystemNavigationShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
          beforeTabsContent={
            <h1 className="text-7 font-semibold tracking-tight text-foreground">
              {t('ecosystem')}
              <span className="ml-2 text-5 font-medium text-muted-foreground">
                | {format.number(ecosystemSpaceCount)}
              </span>
            </h1>
          }
          className={
            resolvedTheme === 'dark' ? 'bg-background-2' : 'bg-neutral-2/85'
          }
          visualizationClassName="min-h-0"
        />
      )}
    </section>
  );
}
