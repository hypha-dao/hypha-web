'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
} from '@hypha-platform/epics';
import { Tooltip, TooltipContent, TooltipTrigger } from '@hypha-platform/ui';
import { ArrowTopRightIcon, PlusIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import { EcosystemMembershipModules } from '@web/app/[lang]/dho/[id]/_components/ecosystem-membership-modules';
import { SpaceVisualization } from '@web/app/[lang]/dho/[id]/_components/space-visualization';
import type { VisibleSpace } from '@web/app/[lang]/dho/[id]/_components/types';

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
  const { lang } = useParams<{ lang: string }>();
  const [focus, setFocus] = useState<{
    slug: string;
    name: string;
  } | null>(null);
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

  const selectedSlug = focus?.slug ?? spaceSlug;
  const selectedTitle = focus?.name ?? currentSpace?.title ?? '';
  const selectedSpace =
    nonArchivedSpaces.find((space) => space.slug === selectedSlug) ??
    (selectedSlug === currentSpace?.slug ? currentSpace : undefined);
  const { canMutate, isLoading: isMutateLoading } = useCanMutateInSpace({
    spaceSlug: selectedSlug,
    space: selectedSpace,
    spaceId: selectedSpace?.web3SpaceId ?? undefined,
  });
  const visitHref = selectedSlug
    ? `/${lang}/dho/${selectedSlug}/ecosystem-navigation`
    : null;
  const addHref =
    canMutate && !isMutateLoading && visitHref
      ? `${visitHref}/space/create`
      : null;
  const onVisibleSpacesChange = useCallback((spaces: VisibleSpace[]) => {
    const next = spaces.find((space) => space.root) ?? spaces[0];
    if (!next?.slug) return;
    setFocus((current) =>
      current?.slug === next.slug && current.name === next.name
        ? current
        : { slug: next.slug, name: next.name },
    );
  }, []);

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
    <div className="flex min-w-0 flex-col gap-3">
      <EcosystemMembershipModules
        spaceSlug={selectedSlug}
        spaceTitle={selectedTitle}
        trailing={
          <div className="flex shrink-0 items-center gap-1">
            {visitHref ? (
              <Tooltip delayDuration={80}>
                <TooltipTrigger asChild>
                  <Link
                    href={visitHref}
                    className={APP_CHROME_ICON_TRIGGER}
                    aria-label={t('visibleSpaces.visitSpace')}
                  >
                    <ArrowTopRightIcon />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{t('visibleSpaces.visitSpace')}</TooltipContent>
              </Tooltip>
            ) : null}
            {addHref ? (
              <Tooltip delayDuration={80}>
                <TooltipTrigger asChild>
                  <Link
                    href={addHref}
                    className={APP_CHROME_ICON_TRIGGER}
                    aria-label={t('visibleSpaces.addSpace')}
                  >
                    <PlusIcon />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{t('visibleSpaces.addSpace')}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        }
      />
      <div className="relative h-[32rem] w-full">
        <SpaceVisualization
          layout="fill"
          data={hierarchy}
          currentSpaceId={currentSpace?.id}
          enableHoverActions={false}
          showNodeLabels
          ariaLabel={t('diagram.ariaLabel')}
          onVisibleSpacesChange={onVisibleSpacesChange}
        />
      </div>
    </div>
  );
}
