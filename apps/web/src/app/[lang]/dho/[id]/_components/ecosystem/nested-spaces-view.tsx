'use client';

import { useMemo, useState } from 'react';
import { useMembers } from '../../../../../../hooks/use-members';
import { SpaceFocusCard } from './space-focus-card';
import { MemberConnectionsView } from './member-connections-view';
import { SpaceVisualization } from '../space-visualization';
import type { EcosystemMemberPreview, HierarchyNode } from './types';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  type Space,
} from '@hypha-platform/core/client';
import type { VisibleSpace } from '../types';
import { useTranslations } from 'next-intl';
import { Image } from '@hypha-platform/ui';

type NestedSpacesViewProps = {
  hierarchyData: HierarchyNode;
  currentSpaceId?: number;
  rootAccentHex: string;
  selectedSpaceTitle: string;
  selectedSpaceSlug: string;
  selectedSpaceRecord: Space | null;
  selectedAccent: string;
  breadcrumbTitles: string[];
  visitHref: string | null;
  addHref: string | null;
  canVisit: boolean;
  canAdd: boolean;
  organisationSpaces?: Space[];
  onVisitSpace?: (slug: string) => void;
  onVisibleSpacesChange: (spaces: VisibleSpace[]) => void;
};

export function NestedSpacesView({
  hierarchyData,
  currentSpaceId,
  rootAccentHex,
  selectedSpaceTitle,
  selectedSpaceSlug,
  selectedSpaceRecord,
  selectedAccent,
  breadcrumbTitles,
  visitHref,
  addHref,
  canVisit,
  canAdd,
  organisationSpaces = [],
  onVisitSpace,
  onVisibleSpacesChange,
}: NestedSpacesViewProps) {
  const t = useTranslations('SelectNavigationAction');
  const [focusedTitle, setFocusedTitle] = useState(selectedSpaceTitle);
  const [focusedLogoUrl, setFocusedLogoUrl] = useState<
    string | null | undefined
  >(selectedSpaceRecord?.logoUrl);
  const { persons, spaces, isLoading } = useMembers({
    spaceSlug: selectedSpaceSlug,
    paginationDisabled: true,
  });

  const personMembers = useMemo<EcosystemMemberPreview[]>(
    () =>
      (persons.data ?? []).map((person) => ({
        id: `person-${person.id}`,
        kind: 'person' as const,
        label:
          [person.name, person.surname].filter(Boolean).join(' ') ||
          person.nickname ||
          person.slug ||
          'Member',
        imageUrl: person.avatarUrl,
        slug: person.slug,
      })),
    [persons.data],
  );

  const spaceMembers = useMemo<EcosystemMemberPreview[]>(
    () =>
      (spaces.data ?? []).map((space) => ({
        id: `space-${space.id}`,
        kind: 'space' as const,
        label: space.title,
        imageUrl: space.logoUrl,
        slug: space.slug,
      })),
    [spaces.data],
  );

  const totalMembers = (persons.data?.length ?? 0) + (spaces.data?.length ?? 0);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <SpaceFocusCard
        title={selectedSpaceTitle}
        logoUrl={selectedSpaceRecord?.logoUrl}
        description={selectedSpaceRecord?.description}
        breadcrumb={breadcrumbTitles}
        personMembers={personMembers}
        spaceMembers={spaceMembers}
        visitHref={visitHref}
        addHref={addHref}
        canVisit={canVisit}
        canAdd={canAdd}
        accentHex={selectedAccent}
        memberCount={isLoading ? undefined : totalMembers}
      />

      <div className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-18rem))]">
        <div className="pointer-events-none absolute left-1 top-1 z-10 max-w-[min(85%,22rem)]">
          <div
            className="relative flex items-center gap-2.5 rounded-2xl border border-border/45 bg-background/78 py-2 pe-3.5 ps-2.5 backdrop-blur-md"
            style={{
              boxShadow: `0 8px 28px rgba(0,0,0,0.16), inset 0 0 0 1px ${selectedAccent}33`,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-y-2 left-0 w-0.5 rounded-full"
              style={{ backgroundColor: selectedAccent }}
            />
            <Image
              src={focusedLogoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
              alt=""
              width={28}
              height={28}
              className="relative h-7 w-7 shrink-0 rounded-xl border border-border/50 object-cover"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t('navigation.focusLabel')}
              </p>
              <p className="truncate text-3 font-semibold tracking-tight text-foreground">
                {focusedTitle}
              </p>
            </div>
          </div>
        </div>

        <SpaceVisualization
          data={hierarchyData}
          currentSpaceId={currentSpaceId}
          rootAccentHex={rootAccentHex || selectedAccent}
          enableHoverActions={false}
          showLabels
          onVisibleSpacesChange={(visible) => {
            const next = visible[0];
            if (next?.name) setFocusedTitle(next.name);
            if (next) setFocusedLogoUrl(next.logoUrl);
            onVisibleSpacesChange(visible);
          }}
        />

        <p className="mt-2 text-center text-1 text-muted-foreground">
          {t('navigation.nestedHint')}
        </p>
      </div>

      <div className="border-t border-border/40 pt-4">
        <MemberConnectionsView
          key={selectedSpaceSlug}
          spaceSlug={selectedSpaceSlug}
          spaceTitle={selectedSpaceTitle}
          spaceLogoUrl={selectedSpaceRecord?.logoUrl}
          organisationSpaces={organisationSpaces}
          accentHex={selectedAccent}
          onVisitSpace={onVisitSpace}
          compact
        />
      </div>
    </div>
  );
}
