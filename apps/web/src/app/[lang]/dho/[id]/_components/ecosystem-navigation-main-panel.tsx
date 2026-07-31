'use client';

import Link from 'next/link';
import {
  Space,
  isSpaceArchived,
  useOrganisationSpacesBySingleSlug,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  APP_CHROME_SUBTLE_SQUARE_RADIUS,
  useCanMutateInSpace,
  useFilterSpacesListWithDiscoverability,
  EcosystemNavigationShell,
  getDhoSpaceContextPath,
} from '@hypha-platform/epics';
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SpaceVisualization } from './space-visualization';
import { sampleAccentHex } from './space-accent-utils';
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

export function EcosystemNavigationMainPanel({
  daoSlug,
  lang,
}: EcosystemNavigationMainPanelProps) {
  const t = useTranslations('SelectNavigationAction');
  const format = useFormatter();
  const pathname = usePathname();
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
        content: (
          <div className="craft-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="h-3.5 w-0.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedSpaceAccent }}
                />
                <div className="min-w-0">
                  <p
                    className="truncate text-2 font-medium tracking-tight text-foreground"
                    title={selectedSpaceTitle}
                  >
                    {selectedSpaceTitle}
                  </p>
                  <p className="craft-meta truncate">{t('diagram.hint')}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {canVisitSpace && visitSpaceHref ? (
                  <Tooltip delayDuration={80}>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant="ghost"
                        colorVariant="neutral"
                        size="icon"
                        className={`h-7 w-7 min-h-7 min-w-7 ${APP_CHROME_SUBTLE_SQUARE_RADIUS}`}
                        aria-label={t('visibleSpaces.visitSpace')}
                      >
                        <Link href={visitSpaceHref}>
                          <ArrowTopRightIcon />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('visibleSpaces.visitSpace')}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {canAddSpace && addSpaceHref ? (
                  <Tooltip delayDuration={80}>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant="ghost"
                        colorVariant="neutral"
                        size="icon"
                        className={`h-7 w-7 min-h-7 min-w-7 ${APP_CHROME_SUBTLE_SQUARE_RADIUS}`}
                        aria-label={t('visibleSpaces.addSpace')}
                      >
                        <Link href={addSpaceHref}>
                          <PlusIcon />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('visibleSpaces.addSpace')}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
            <EcosystemMembershipModules spaceSlug={selectedSpaceSlug} />
            {hierarchyData ? (
              <div className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-18rem))] px-2 pb-2 pt-1 sm:px-3 sm:pb-3">
                <SpaceVisualization
                  data={hierarchyData}
                  currentSpaceId={currentSpace?.id}
                  rootAccentHex={rootSpaceAccent}
                  enableHoverActions={false}
                  showNodeLabels
                  ariaLabel={t('diagram.ariaLabel')}
                  onVisibleSpacesChange={handleVisibleSpacesChange}
                />
              </div>
            ) : (
              <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-4 py-8">
                <div className="craft-empty-mark" aria-hidden />
                <p className="craft-meta text-center">{t('diagram.empty')}</p>
              </div>
            )}
          </div>
        ),
      },
      {
        value: 'space-to-space',
        label: t('tabs.spaceToSpace'),
        content: (
          <div className="craft-card flex min-h-[16rem] flex-col items-center justify-center gap-3 px-4 py-8">
            <div className="craft-empty-mark" aria-hidden />
            <p className="craft-meta text-center">
              {t('comingSoon.spaceToSpaceVisualization')}
            </p>
          </div>
        ),
      },
      {
        value: 'values-flows',
        label: t('tabs.valuesFlows'),
        content: (
          <div className="craft-card flex min-h-[16rem] flex-col items-center justify-center gap-3 px-4 py-8">
            <div className="craft-empty-mark" aria-hidden />
            <p className="craft-meta text-center">
              {t('comingSoon.valuesFlowsVisualization')}
            </p>
          </div>
        ),
      },
    ],
    [
      addSpaceHref,
      canAddSpace,
      canVisitSpace,
      currentSpace?.id,
      handleVisibleSpacesChange,
      hierarchyData,
      rootSpaceAccent,
      selectedSpaceAccent,
      selectedSpaceSlug,
      selectedSpaceTitle,
      t,
      visitSpaceHref,
    ],
  );

  return (
    <section className="flex w-full flex-col gap-4 py-4">
      {isLoading ? (
        <>
          <header className="craft-page-header">
            <h1 className="craft-page-title flex items-baseline gap-2 text-6 font-medium">
              <span>{t('ecosystem')}</span>
            </h1>
          </header>
          <div
            className="craft-card flex min-h-[20rem] flex-col items-center justify-center gap-3 px-4 py-8"
            role="status"
            aria-live="polite"
          >
            <div className="craft-empty-mark" aria-hidden />
            <p className="craft-meta">{t('diagram.loading')}</p>
          </div>
        </>
      ) : (
        <EcosystemNavigationShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
          beforeTabsContent={
            <header className="craft-page-header">
              <h1 className="craft-page-title flex items-baseline gap-2 text-6 font-medium">
                <span>{t('ecosystem')}</span>
                <span className="text-3 font-normal text-muted-foreground">
                  {format.number(ecosystemSpaceCount)}
                </span>
              </h1>
              <p className="craft-meta max-w-xl">{t('diagram.subtitle')}</p>
            </header>
          }
          visualizationClassName="min-h-0"
        />
      )}
    </section>
  );
}
