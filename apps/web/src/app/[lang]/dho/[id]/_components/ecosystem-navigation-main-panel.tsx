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
  releaseMainColumnScrollHeightHold,
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

function readMenuTop(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--menu-top-height',
  );
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 70;
}

/**
 * Bottom of the collapsed header: top menu, plus the sticky space bar when
 * it is actually painted. The bar is `hidden` below `md`, so its height is 0
 * on a phone and must not be invented from the desktop row.
 */
function collapsedHeaderBottom(): number {
  const bar = document.querySelector('[data-space-sticky-bar]');
  const barHeight =
    bar instanceof HTMLElement ? bar.getBoundingClientRect().height : 0;
  return readMenuTop() + (barHeight >= 1 ? barHeight : 0);
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findScrollParent(stage: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = stage.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Scroll offset that puts the banner's bottom edge on the sticky row.
 * `scrollTop + sentinelBottom` is a content length, so live scrolling does
 * not change it.
 */
function collapsedBannerScroll(scrollParent: HTMLElement): number {
  const sentinel = document.querySelector('[data-space-banner-bottom]');
  if (!(sentinel instanceof HTMLElement)) return 0;
  return Math.max(
    0,
    scrollParent.scrollTop +
      sentinel.getBoundingClientRect().bottom -
      collapsedHeaderBottom(),
  );
}

/**
 * In-flow column height, without the empty band. Auto margins and the
 * route-change min-height are that band — counting them locks the stage at
 * its current (short) size.
 */
function columnContentHeight(scrollParent: HTMLElement): number {
  const hold = scrollParent.querySelector<HTMLElement>(
    '[data-space-scroll-hold]',
  );
  const prevMin = hold?.style.minHeight ?? '';
  const prevScroll = scrollParent.scrollTop;
  if (hold) hold.style.minHeight = '0px';

  const parentStyle = getComputedStyle(scrollParent);
  let used =
    px(parentStyle.paddingTop) +
    px(parentStyle.paddingBottom) +
    px(parentStyle.borderTopWidth) +
    px(parentStyle.borderBottomWidth);

  const kids = Array.from(scrollParent.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  const gap = px(parentStyle.rowGap);
  if (kids.length > 1 && gap > 0) used += gap * (kids.length - 1);

  for (const child of kids) {
    used += child.offsetHeight;
    const style = getComputedStyle(child);
    const skipBottom =
      child.classList.contains('mb-auto') ||
      child.classList.contains('my-auto');
    const skipTop =
      child.classList.contains('mt-auto') ||
      child.classList.contains('my-auto');
    if (!skipTop) used += px(style.marginTop);
    if (!skipBottom) used += px(style.marginBottom);
  }

  if (hold) hold.style.minHeight = prevMin;
  if (Math.abs(scrollParent.scrollTop - prevScroll) > 0.5) {
    scrollParent.scrollTop = prevScroll;
  }
  return used;
}

/**
 * Stage box that makes the column exactly fill the scrollport once the
 * banner is collapsed. Independent of the stage's current height.
 */
function stageHeightForCollapsedColumn(
  stageHeight: number,
  contentHeight: number,
  collapsedScroll: number,
  scrollportHeight: number,
): number {
  return stageHeight + collapsedScroll + scrollportHeight - contentHeight;
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

  // One height for the collapsed banner (sticky header showing). Scrolling
  // the cover must not remeasure: live viewport tops shrink the stage to a
  // sliver and back on each frame. A phone with no room under the membership
  // block gets a square of the column width instead of a zero-height stage.
  useLayoutEffect(() => {
    const stage = diagramStageRef.current;
    if (!stage || isLoading) return;

    const scrollParent = findScrollParent(stage);
    let measuring = false;

    const apply = () => {
      if (measuring) return;
      const current = diagramStageRef.current;
      if (!current || !scrollParent) return;
      measuring = true;
      try {
        const stageWidth = Math.round(current.getBoundingClientRect().width);
        if (stageWidth < 64) return;

        const contentHeight = columnContentHeight(scrollParent);
        const collapsedScroll = collapsedBannerScroll(scrollParent);
        // Room left for the stage once the banner is collapsed and the footer
        // sits on the scrollport bottom. A viewport-top reading leaves the
        // auto-margin / scroll-hold band empty under a short drawing.
        const room = stageHeightForCollapsedColumn(
          current.offsetHeight,
          contentHeight,
          collapsedScroll,
          scrollParent.clientHeight,
        );
        const next = room >= 64 ? Math.round(room) : stageWidth;
        const heightMatches =
          Math.abs(next - current.offsetHeight) <= 2 &&
          current.style.aspectRatio === 'auto';
        if (!heightMatches) {
          current.style.aspectRatio = 'auto';
          current.style.height = `${next}px`;
          current.style.maxHeight = `${next}px`;
          current.style.minHeight = `${next}px`;
        }

        // The hold extends the space column so a short page can keep the
        // banner collapsed. Once the stage fills that scroll, the hold is the
        // black band under the cluster — drop it.
        const filled =
          columnContentHeight(scrollParent) - scrollParent.clientHeight;
        if (filled + 2 >= collapsedScroll) {
          releaseMainColumnScrollHeightHold();
        }
      } finally {
        measuring = false;
      }
    };

    apply();
    const observer = new ResizeObserver(apply);
    const membership = stage.previousElementSibling;
    if (membership instanceof HTMLElement) observer.observe(membership);
    if (stage.parentElement) observer.observe(stage.parentElement);
    if (scrollParent) {
      observer.observe(scrollParent);
      for (const child of scrollParent.children) {
        if (child instanceof HTMLElement && !child.contains(stage)) {
          observer.observe(child);
        }
      }
    }
    const banner = document.querySelector('[data-space-banner-bottom]');
    if (banner?.parentElement instanceof HTMLElement) {
      observer.observe(banner.parentElement);
    }
    const footerWatch = new MutationObserver(apply);
    if (scrollParent) {
      footerWatch.observe(scrollParent, { childList: true });
    }
    window.addEventListener('resize', apply);
    return () => {
      observer.disconnect();
      footerWatch.disconnect();
      window.removeEventListener('resize', apply);
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
              className="relative w-full shrink-0 overflow-hidden"
            >
              {hierarchyData ? (
                <SpaceVisualization
                  layout="fill"
                  data={hierarchyData}
                  currentSpaceId={currentSpace?.id}
                  enableHoverActions={false}
                  showNodeLabels
                  ariaLabel={t('diagram.ariaLabel')}
                  onVisibleSpacesChange={handleVisibleSpacesChange}
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
