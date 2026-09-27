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
  subscribeMainColumnScroll,
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

/**
 * How far the open cover sits below the collapsed banner.
 * Zero when the banner is already showing, so the settled stage size is unchanged.
 */
function openCoverScrollDelta(): number {
  const sentinel = document.querySelector('[data-space-banner-bottom]');
  const bar = document.querySelector('[data-space-sticky-bar]');
  if (!(sentinel instanceof HTMLElement) || !(bar instanceof HTMLElement)) {
    return 0;
  }
  const barHeight = bar.getBoundingClientRect().height;
  if (barHeight < 1) return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--menu-top-height',
  );
  const parsed = Number.parseFloat(raw);
  const menuTop = Number.isFinite(parsed) && parsed > 0 ? parsed : 70;
  const delta = sentinel.getBoundingClientRect().bottom - (menuTop + barHeight);
  return delta > 16 ? delta : 0;
}

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

  // Fill the column between the membership row and the footer. The square
  // drawing is centred in that stage (`xMidYMid`), so a tall slot balances
  // it instead of leaving a dead band underneath. Ancestor padding is kept
  // so the outer rings are not clipped by the footer. An open cover puts the
  // stage in a leftover sliver; measure that pass against the collapsed
  // banner so the short height is not locked. The settled pass is unchanged.
  useLayoutEffect(() => {
    const stage = diagramStageRef.current;
    if (!stage || isLoading) return;

    let scrollParent: HTMLElement | null = stage.parentElement;
    while (scrollParent) {
      const overflow = getComputedStyle(scrollParent).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }

    const apply = () => {
      const current = diagramStageRef.current;
      if (!current) return;

      const stageRect = current.getBoundingClientRect();
      if (stageRect.width <= 0) return;

      // Open cover: the footer sits in the leftover sliver, so do not use it
      // as the cap. Size to the viewport under the collapsed banner instead.
      const coverDelta = openCoverScrollDelta();
      const stageTop = stageRect.top - coverDelta;

      let limit = window.innerHeight;
      if (scrollParent) {
        limit = Math.min(limit, scrollParent.getBoundingClientRect().bottom);
        if (coverDelta === 0) {
          for (const child of Array.from(scrollParent.children)) {
            if (!(child instanceof HTMLElement) || child.contains(current)) {
              continue;
            }
            const rect = child.getBoundingClientRect();
            if (rect.height < 24 || rect.width < 80) continue;
            if (rect.top > stageRect.top + 8) {
              limit = Math.min(limit, rect.top);
            }
          }
        }
      }

      // Padding under the stage (page `pb-8`, section padding). Skip
      // `margin-bottom: auto` — that slack is the empty band we want to use.
      let chrome = 8;
      let node: HTMLElement | null = current.parentElement;
      while (node && node !== scrollParent) {
        const style = getComputedStyle(node);
        chrome += Number.parseFloat(style.paddingBottom) || 0;
        chrome += Number.parseFloat(style.borderBottomWidth) || 0;
        const skipsAutoMargin =
          node.classList.contains('mb-auto') ||
          node.classList.contains('my-auto');
        if (!skipsAutoMargin) {
          chrome += Number.parseFloat(style.marginBottom) || 0;
        }
        node = node.parentElement;
      }

      const slot = Math.round(limit - stageTop - chrome);
      const viewportCap = Math.round(window.innerHeight - stageTop - 8);
      const next = Math.min(slot, viewportCap);
      if (!Number.isFinite(next) || next < 64) return;
      if (Math.abs(next - Math.round(stageRect.height)) <= 2) return;
      current.style.height = `${next}px`;
    };

    apply();
    const observer = new ResizeObserver(apply);
    if (scrollParent) observer.observe(scrollParent);
    if (stage.parentElement) observer.observe(stage.parentElement);
    window.addEventListener('resize', apply);
    // Re-measure when an open cover settles, so a sliver measured earlier is
    // replaced by the collapsed-banner size. Scrolling the cover back open
    // must not restyle a stage that is already that size.
    let coverOpen = openCoverScrollDelta() > 0;
    const unsubscribeScroll = subscribeMainColumnScroll(() => {
      const open = openCoverScrollDelta() > 0;
      const crossed = open !== coverOpen;
      coverOpen = open;
      if (!crossed) return;
      if (!open) {
        apply();
        return;
      }
      const stageEl = diagramStageRef.current;
      if (!stageEl) return;
      const rect = stageEl.getBoundingClientRect();
      const wanted = window.innerHeight - (rect.top - openCoverScrollDelta());
      if (rect.height + 2 < wanted) apply();
    });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      unsubscribeScroll();
    };
  }, [hierarchyData, isLoading]);

  return (
    <section className="flex w-full flex-col gap-3 pt-2 pb-0">
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
        <EcosystemNavigationShell className="gap-2" header={ecosystemHeader}>
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
              className="relative min-h-0 w-full shrink-0"
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
