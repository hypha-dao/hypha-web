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
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useTheme } from 'next-themes';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SpaceVisualization } from './space-visualization';
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

function parseHex(hex: string): [number, number, number] | null {
  const normalized = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

function toRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return `rgba(20,184,166,${alpha})`;
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getContrastColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb;
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 160 ? '#0f172a' : '#ffffff';
}

function toSampleableImageSrc(src?: string | null): string | null {
  if (!src) return null;
  const candidate = src.trim();
  if (!candidate) return null;
  if (candidate.startsWith('/')) {
    return candidate.startsWith('//') ? null : candidate;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `/_next/image?url=${encodeURIComponent(candidate)}&w=96&q=75`;
    }
  } catch {
    return null;
  }
  return null;
}

async function sampleAccentHex(src?: string | null): Promise<string | null> {
  const imageSrc = toSampleableImageSrc(src);
  if (!imageSrc) return null;
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const maxSide = 96;
        const scale = Math.min(
          maxSide / image.width,
          maxSide / image.height,
          1,
        );
        const width = Math.max(8, Math.round(image.width * scale));
        const height = Math.max(8, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3] ?? 0;
          if (alpha < 40) continue;
          const r = pixels[i] ?? 0;
          const g = pixels[i + 1] ?? 0;
          const b = pixels[i + 2] ?? 0;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          if (saturation < 0.12) continue;
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
        if (count < 6) {
          resolve(null);
          return;
        }
        const r = Math.round(rSum / count)
          .toString(16)
          .padStart(2, '0');
        const g = Math.round(gSum / count)
          .toString(16)
          .padStart(2, '0');
        const b = Math.round(bSum / count)
          .toString(16)
          .padStart(2, '0');
        resolve(`#${r}${g}${b}`);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageSrc;
  });
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
  const { resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('nested-spaces');
  const [selectedSpaceAccent, setSelectedSpaceAccent] = useState(
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
  const selectedSpaceSlug = selectedSpace?.slug ?? currentSpaceSlug;
  const canRenderSpaceActions = Boolean(currentSpace && selectedSpaceSlug);
  const visitSpaceHref =
    canRenderSpaceActions && selectedSpaceSlug
      ? getDhoSpaceContextPath({
          pathname,
          lang,
          spaceSlug: selectedSpaceSlug,
        })
      : null;
  const addSpaceHref =
    canRenderSpaceActions && visitSpaceHref
      ? `${visitSpaceHref}/space/create`
      : null;
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

  const iconOutlineStyle = useMemo(
    () => ({
      borderColor: toRgba(selectedSpaceAccent, 0.7),
      color: resolvedTheme === 'dark' ? '#f8fafc' : selectedSpaceAccent,
      backgroundColor: toRgba(selectedSpaceAccent, 0.12),
    }),
    [selectedSpaceAccent, resolvedTheme],
  );

  const iconFilledStyle = useMemo(
    () => ({
      backgroundColor: selectedSpaceAccent,
      borderColor: selectedSpaceAccent,
      color: getContrastColor(selectedSpaceAccent),
    }),
    [selectedSpaceAccent],
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
                <div className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-16rem))]">
                  {canRenderSpaceActions && visitSpaceHref && addSpaceHref ? (
                    <div className="pointer-events-none absolute inset-x-4 top-10 z-20 flex justify-center sm:top-12">
                      <div className="pointer-events-auto inline-flex max-w-[92%] items-center gap-1.5 rounded-full border border-border/60 bg-background/88 px-2 py-1.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/72 sm:gap-2 sm:px-3">
                        <span
                          className="max-w-[14rem] truncate text-4 font-semibold tracking-tight text-foreground sm:max-w-[20rem]"
                          title={selectedSpaceTitle}
                        >
                          {selectedSpaceTitle}
                        </span>
                        <Tooltip delayDuration={80}>
                          <TooltipTrigger asChild>
                            <Button
                              asChild
                              variant="outline"
                              colorVariant="neutral"
                              className="h-7 w-7 p-0"
                              style={iconOutlineStyle}
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
                        <Tooltip delayDuration={80}>
                          <TooltipTrigger asChild>
                            <Button
                              asChild
                              variant="default"
                              colorVariant="accent"
                              className="h-7 w-7 p-0"
                              style={iconFilledStyle}
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
                      </div>
                    </div>
                  ) : null}
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
    [
      addSpaceHref,
      canRenderSpaceActions,
      currentSpace?.id,
      handleVisibleSpacesChange,
      hierarchyData,
      selectedSpaceTitle,
      iconOutlineStyle,
      iconFilledStyle,
      t,
      visitSpaceHref,
    ],
  );

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
