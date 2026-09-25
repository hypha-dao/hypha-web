'use client';

import Link from 'next/link';
import {
  Space,
  isSpaceArchived,
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  APP_CHROME_ICON_TRIGGER,
  useCanMutateInSpace,
  useFilterSpacesListWithDiscoverability,
  EcosystemNavigationShell,
  getDhoSpaceContextPath,
} from '@hypha-platform/epics';
import { Tooltip, TooltipContent, TooltipTrigger } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useFormatter, useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { SpaceVisualization } from './space-visualization';
import { EcosystemMembershipModules } from './ecosystem-membership-modules';
import type { VisibleSpace } from './types';
import { ArrowTopRightIcon, PlusIcon } from '@radix-ui/react-icons';

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

export function EcosystemNavigationMainPanel({
  daoSlug,
  lang,
}: EcosystemNavigationMainPanelProps) {
  const t = useTranslations('SelectNavigationAction');
  const format = useFormatter();
  const pathname = usePathname();
  const diagramStageRef = useRef<HTMLDivElement>(null);
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
  const ecosystemHeader = (
    <header className="craft-page-header">
      <h1 className="craft-page-title flex items-baseline gap-2 text-6 font-medium">
        <span>{t('ecosystem')}</span>
        {isLoading ? null : (
          <span className="text-3 font-normal text-muted-foreground">
            {format.number(ecosystemSpaceCount)}
          </span>
        )}
      </h1>
    </header>
  );

  // Size the stage to the visible scrollport. Stretching it to a footer below
  // the fold centres the orbit in that tall box, so the screen is empty paper.
  useLayoutEffect(() => {
    const stage = diagramStageRef.current;
    if (!stage || isLoading) return;

    let scrollParent: HTMLElement | null = stage.parentElement;
    while (scrollParent) {
      const overflow = getComputedStyle(scrollParent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent) return;

    const apply = () => {
      const current = diagramStageRef.current;
      if (!current || scrollParent == null) return;

      const stageRect = current.getBoundingClientRect();
      const scrollRect = scrollParent.getBoundingClientRect();
      if (stageRect.width <= 0) return;

      const footer = scrollParent.lastElementChild;
      let limit = scrollRect.bottom;
      if (
        footer instanceof HTMLElement &&
        !footer.contains(current) &&
        footer.getBoundingClientRect().height > 0
      ) {
        const footerTop = footer.getBoundingClientRect().top;
        if (footerTop > stageRect.top) {
          limit = Math.min(limit, footerTop);
        }
      }

      const restGap = 48;
      const visibleHeight = Math.round(limit - stageRect.top - restGap);
      const cap = Math.max(320, Math.round(scrollRect.height - restGap));
      const next = Math.max(320, Math.min(visibleHeight, cap));
      if (Math.abs(next - Math.round(stageRect.height)) <= 2) return;
      current.style.height = `${next}px`;
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(scrollParent);
    if (stage.parentElement) observer.observe(stage.parentElement);
    window.addEventListener('resize', apply);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [hierarchyData, isLoading]);

  return (
    <section className="flex w-full flex-col gap-4 py-4">
      {isLoading ? (
        <>
          {ecosystemHeader}
          <div
            className="flex min-h-[20rem] flex-col items-center justify-center gap-3 px-4 py-8"
            role="status"
            aria-live="polite"
          >
            <div className="craft-empty-mark" aria-hidden />
            <p className="craft-meta">{t('diagram.loading')}</p>
          </div>
        </>
      ) : (
        <EcosystemNavigationShell header={ecosystemHeader}>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <EcosystemMembershipModules
              spaceSlug={selectedSpaceSlug}
              spaceTitle={selectedSpaceTitle}
              trailing={
                <div className="flex shrink-0 items-center gap-1">
                  {canVisitSpace && visitSpaceHref ? (
                    <Tooltip delayDuration={80}>
                      <TooltipTrigger asChild>
                        <Link
                          href={visitSpaceHref}
                          className={APP_CHROME_ICON_TRIGGER}
                          aria-label={t('visibleSpaces.visitSpace')}
                        >
                          <ArrowTopRightIcon />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('visibleSpaces.visitSpace')}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  {canAddSpace && addSpaceHref ? (
                    <Tooltip delayDuration={80}>
                      <TooltipTrigger asChild>
                        <Link
                          href={addSpaceHref}
                          className={APP_CHROME_ICON_TRIGGER}
                          aria-label={t('visibleSpaces.addSpace')}
                        >
                          <PlusIcon />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('visibleSpaces.addSpace')}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              }
            />
            <div
              ref={diagramStageRef}
              className="relative min-h-[20rem] w-full shrink-0"
            >
              {hierarchyData ? (
                <SpaceVisualization
                  data={hierarchyData}
                  currentSpaceId={currentSpace?.id}
                  enableHoverActions={false}
                  showNodeLabels
                  ariaLabel={t('diagram.ariaLabel')}
                  onVisibleSpacesChange={handleVisibleSpacesChange}
                  className="absolute inset-0 h-full w-full aspect-auto"
                />
              ) : (
                <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-3 px-4 py-8">
                  <div className="craft-empty-mark" aria-hidden />
                  <p className="craft-meta text-center">{t('diagram.empty')}</p>
                </div>
              )}
            </div>
          </div>
        </EcosystemNavigationShell>
      )}
    </section>
  );
}
