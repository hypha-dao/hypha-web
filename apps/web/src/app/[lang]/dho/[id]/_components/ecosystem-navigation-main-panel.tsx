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
  const main = document.getElementById('hypha-screen-share-main-content');
  if (main instanceof HTMLElement && main.contains(stage)) {
    const overflow = getComputedStyle(main).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return main;
  }
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

/**
 * Page footer after the space column inside the scrollport. The space
 * footer is a plain div ("Powered by"), not a `<footer>` element.
 */
function findColumnFooter(
  scrollParent: HTMLElement,
  stage: HTMLElement,
): HTMLElement | null {
  const kids = Array.from(scrollParent.children).filter(
    (kid): kid is HTMLElement => kid instanceof HTMLElement,
  );
  const contentIndex = kids.findIndex((kid) => kid.contains(stage));
  if (contentIndex < 0) return null;
  for (let i = kids.length - 1; i > contentIndex; i -= 1) {
    const kid = kids[i];
    if (kid && kid.offsetHeight >= 8) return kid;
  }
  return null;
}

/**
 * How far the stage's border box extends past the footer's top.
 * Scroll-invariant: both edges move together when the column scrolls.
 * Positive when the stage paints underneath the footer.
 */
function stageOverlapUnderFooter(
  stage: HTMLElement,
  footer: HTMLElement,
): number {
  return (
    stage.getBoundingClientRect().bottom - footer.getBoundingClientRect().top
  );
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
    // Last painted membership-row height. The row is `role="status"` while
    // member avatars load: it collapses, then grows back. Each of those
    // heights rewrites the stage, and the diagram refits its viewBox on
    // every pass. Holding the row still leaves the stage on one measurement.
    let settledMembershipHeight = 0;
    // Once the stage is seen painting under the footer, keep that clearance.
    // Re-reading the overlap after the shrink would chase an in-flow footer
    // and jump the height on every pass. Keyed by column width and footer
    // height so a real resize can measure again. Not tied to scroll position.
    let footerClearance: number | null = null;
    let footerClearanceKey = '';
    let footerChecked = false;
    let footerObserved = false;
    let observer: ResizeObserver | null = null;

    const holdMembershipRow = (stageEl: HTMLElement) => {
      const membership = stageEl.previousElementSibling;
      if (!(membership instanceof HTMLElement)) return;
      const loading = membership.getAttribute('role') === 'status';
      if (loading && settledMembershipHeight > 0) {
        const held = `${Math.round(settledMembershipHeight)}px`;
        if (membership.style.minHeight !== held) {
          membership.style.minHeight = held;
        }
        return;
      }
      if (!loading) {
        if (membership.style.minHeight) membership.style.minHeight = '';
        const height = membership.offsetHeight;
        if (height > 0) settledMembershipHeight = height;
      }
    };

    const apply = () => {
      if (measuring) return;
      const current = diagramStageRef.current;
      if (!current || !scrollParent) return;
      measuring = true;
      try {
        const stageWidth = Math.round(current.getBoundingClientRect().width);
        if (stageWidth < 64) return;

        holdMembershipRow(current);
        const contentHeight = columnContentHeight(scrollParent);
        const collapsedScroll = collapsedBannerScroll(scrollParent);
        const footer = findColumnFooter(scrollParent, current);
        if (footer && observer && !footerObserved) {
          observer.observe(footer);
          footerObserved = true;
        }
        // Room left for the stage once the banner is collapsed. The footer
        // is in the scrollport and paints over whatever runs past its top,
        // so a stage that fills the scrollport tucks the lower rings under
        // "Powered by". Clearance is the overlap measured once per column
        // width — not on each scroll frame.
        let room = stageHeightForCollapsedColumn(
          current.offsetHeight,
          contentHeight,
          collapsedScroll,
          scrollParent.clientHeight,
        );
        const footerKey = `${stageWidth}:${footer?.offsetHeight ?? 0}`;
        if (footerKey !== footerClearanceKey) {
          footerClearanceKey = footerKey;
          footerClearance = null;
          footerChecked = false;
        }
        if (footer && footerClearance == null && !footerChecked) {
          // Paint the filled height first, then read whether that box crosses
          // the footer. Both writes happen before paint, so the diagram fits
          // the cleared slot once instead of jumping.
          const filledHeight = Math.max(0, Math.round(room));
          if (Math.abs(current.offsetHeight - filledHeight) > 2) {
            const filledPx = `${filledHeight}px`;
            current.style.height = filledPx;
            current.style.maxHeight = filledPx;
            current.style.minHeight = filledPx;
          }
          const overlap = stageOverlapUnderFooter(current, footer);
          footerChecked = true;
          if (overlap > 1) {
            footerClearance = Math.max(0, current.offsetHeight - overlap);
          }
        }
        if (footerClearance != null) {
          room = Math.min(room, footerClearance);
        }
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
    observer = new ResizeObserver(apply);
    const stageObserver = observer;
    const membership = stage.previousElementSibling;
    if (membership instanceof HTMLElement) stageObserver.observe(membership);
    if (stage.parentElement) stageObserver.observe(stage.parentElement);
    if (scrollParent) {
      stageObserver.observe(scrollParent);
      for (const child of scrollParent.children) {
        if (child instanceof HTMLElement && !child.contains(stage)) {
          stageObserver.observe(child);
        }
      }
    }
    const banner = document.querySelector('[data-space-banner-bottom]');
    if (banner?.parentElement instanceof HTMLElement) {
      stageObserver.observe(banner.parentElement);
    }
    const footerWatch = new MutationObserver(apply);
    if (scrollParent) {
      footerWatch.observe(scrollParent, { childList: true });
    }
    window.addEventListener('resize', apply);
    return () => {
      stageObserver.disconnect();
      footerWatch.disconnect();
      window.removeEventListener('resize', apply);
      const membership = diagramStageRef.current?.previousElementSibling;
      if (membership instanceof HTMLElement && membership.style.minHeight) {
        membership.style.minHeight = '';
      }
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
