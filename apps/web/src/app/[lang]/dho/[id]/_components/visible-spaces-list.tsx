'use client';

import { useState, useMemo } from 'react';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import {
  Card,
  Button,
  Badge,
  Input,
  Avatar,
  AvatarImage,
} from '@hypha-platform/ui';
import { PlusIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { getDhoPathAgreements } from '@hypha-platform/epics';

type VisibleSpace = {
  id: number;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  parentId?: number | null;
  root: boolean;
};

type VisibleSpacesListProps = {
  visibleSpaces: VisibleSpace[];
  allSpaces: Space[];
  lang: Locale;
  entrySpaceId?: number;
};

const DEFAULT_LOGO = '/placeholder/space-avatar-image.svg';

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

  const filteredSpaces = useMemo(() => {
    if (!searchQuery.trim()) {
      return visibleSpaces;
    }

    const query = searchQuery.toLowerCase();
    return visibleSpaces.filter((space) =>
      space.name.toLowerCase().includes(query),
    );
  }, [visibleSpaces, searchQuery]);

  const getCreateSpacePath = (spaceId: number, spaceSlug?: string) => {
    if (!spaceSlug) return '#';
    return `/${lang}/dho/${spaceSlug}/space/create`;
  };

  return (
    <div className="flex flex-col gap-4">
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
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <AvatarImage
                    src={space.logoUrl || DEFAULT_LOGO}
                    alt={space.name}
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

                <div className="flex gap-2 flex-shrink-0">
                  <Link href={createSpacePath}>
                    <Button
                      variant="default"
                      size="default"
                      colorVariant="accent"
                    >
                      <PlusIcon className="w-4 h-4" />
                      New Space
                    </Button>
                  </Link>
                  <Link href={visitSpacePath}>
                    <Button
                      colorVariant="neutral"
                      variant="outline"
                      size="default"
                      disabled={space.id === entrySpaceId}
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
