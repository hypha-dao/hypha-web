'use client';

import { useState, useMemo } from 'react';
import { Locale } from '@hypha-platform/i18n';
import { Space, DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import {
  Card,
  Button,
  Badge,
  Input,
  Avatar,
  AvatarImage,
  Separator,
} from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { getDhoPathAgreements } from '@hypha-platform/epics';
import type { VisibleSpace } from './types';

type VisibleSpacesListProps = {
  visibleSpaces: VisibleSpace[];
  allSpaces: Space[];
  lang: Locale;
  entrySpaceId?: number;
};

function buildNestedPath(space: VisibleSpace, allSpaces: Space[]): string {
  if (space.root) {
    return 'Root';
  }

  if (space.parentId) {
    const parent = allSpaces.find((s) => s.id === space.parentId);
    if (parent) {
      return `Nested in ${parent.title}`;
    }
  }

  return 'Nested';
}

export function VisibleSpacesList({
  visibleSpaces,
  allSpaces,
  lang,
  entrySpaceId,
}: VisibleSpacesListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { rootSpace, descendantSpaces } = useMemo(() => {
    const root = visibleSpaces.find((space) => space.root);
    const descendants = visibleSpaces.filter((space) => !space.root);
    return { rootSpace: root, descendantSpaces: descendants };
  }, [visibleSpaces]);

  const filteredSpaces = useMemo(() => {
    if (!searchQuery.trim()) {
      return descendantSpaces;
    }

    const query = searchQuery.toLowerCase();
    return descendantSpaces.filter((space) =>
      space.name.toLowerCase().includes(query),
    );
  }, [descendantSpaces, searchQuery]);

  const getCreateSpacePath = (spaceId: number, spaceSlug?: string) => {
    if (!spaceSlug) return '#';
    return `/${lang}/dho/${spaceSlug}/space/create`;
  };

  if (!rootSpace) {
    return null;
  }

  const rootNestedPath = buildNestedPath(rootSpace, allSpaces);
  const rootCreateSpacePath = getCreateSpacePath(rootSpace.id, rootSpace.slug);
  const rootVisitSpacePath = rootSpace.slug
    ? getDhoPathAgreements(lang, rootSpace.slug)
    : '#';

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Avatar className="w-12 h-12 flex-shrink-0">
              <AvatarImage
                src={rootSpace.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                alt={`${rootSpace.name} logo`}
              />
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="text-base font-medium text-foreground mb-1">
                {rootSpace.name}
              </div>
              <Badge
                variant="outline"
                size={1}
                colorVariant="neutral"
                className="w-fit"
              >
                {rootNestedPath}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0 md:flex-shrink-0">
            <Link href={{}} className="flex-1 md:flex-none cursor-not-allowed">
              <Button
                variant="default"
                size="default"
                colorVariant="accent"
                className="w-full md:w-auto"
                disabled={true}
                title="Under Maintenance"
              >
                <PlusIcon className="w-4 h-4" />
                Add Space (Under Maintenance)
              </Button>
            </Link>
            <Link href={rootVisitSpacePath} className="flex-1 md:flex-none">
              <Button
                colorVariant="neutral"
                variant="outline"
                size="default"
                disabled={rootSpace.id === entrySpaceId}
                className="w-full md:w-auto"
              >
                Visit Space
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <Separator />

      <div className="flex gap-2">
        <Input
          placeholder="Search spaces"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
      </div>

      <div className="flex flex-col gap-3">
        {filteredSpaces.map((space) => {
          const nestedPath = buildNestedPath(space, allSpaces);
          const createSpacePath = getCreateSpacePath(space.id, space.slug);
          const visitSpacePath = space.slug
            ? getDhoPathAgreements(lang, space.slug)
            : '#';

          return (
            <Card key={space.id} className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarImage
                      src={space.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                      alt={`${space.name} logo`}
                    />
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-foreground mb-1">
                      {space.name}
                    </div>
                    <Badge
                      variant="outline"
                      size={1}
                      colorVariant="neutral"
                      className="w-fit"
                    >
                      {nestedPath}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0 md:flex-shrink-0">
                  <Link
                    href={{}}
                    className="flex-1 md:flex-none cursor-not-allowed"
                  >
                    <Button
                      variant="default"
                      size="default"
                      colorVariant="accent"
                      className="w-full md:w-auto"
                      disabled={true}
                      title="Under Maintenance"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Space (Under Maintenance)
                    </Button>
                  </Link>
                  <Link href={visitSpacePath} className="flex-1 md:flex-none">
                    <Button
                      colorVariant="neutral"
                      variant="outline"
                      size="default"
                      disabled={space.id === entrySpaceId}
                      className="w-full md:w-auto"
                    >
                      Visit Space
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredSpaces.length === 0 && (
        <div className="text-center text-neutral-11 py-8">No spaces found</div>
      )}
    </div>
  );
}
