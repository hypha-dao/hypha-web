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
import {
  useCanMutateInSpace,
  getDhoSpaceContextPath,
} from '@hypha-platform/epics';
import type { VisibleSpace } from './types';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

type VisibleSpacesListProps = {
  visibleSpaces: VisibleSpace[];
  allSpaces?: Space[];
  lang: Locale;
  entrySpaceId?: number;
};

type AddSpaceButtonProps = {
  space: VisibleSpace;
  allSpaces: Space[];
  lang: Locale;
};

function AddSpaceButton({ space, allSpaces, lang }: AddSpaceButtonProps) {
  const t = useTranslations('SelectNavigationAction');
  const pathname = usePathname();
  const safeAllSpaces = Array.isArray(allSpaces) ? allSpaces : [];
  const fullSpace = safeAllSpaces.find((s) => s.id === space.id);
  const web3SpaceId = fullSpace?.web3SpaceId;
  const spaceSlug = fullSpace?.slug || space.slug;
  const hasSpaceInfo = !!web3SpaceId && !!spaceSlug;

  const { canMutate, isLoading } = useCanMutateInSpace({
    spaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
    spaceSlug,
    space: fullSpace,
  });

  if (!hasSpaceInfo) {
    return (
      <Button
        variant="default"
        size="default"
        colorVariant="accent"
        className="w-full md:w-auto"
        disabled={true}
        title={t('visibleSpaces.spaceInfoNotAvailable')}
      >
        <PlusIcon className="w-4 h-4" />
        {t('visibleSpaces.addSpace')}
      </Button>
    );
  }

  const isDisabled = isLoading || !canMutate;

  const createSpacePath = `${
    getDhoSpaceContextPath({
      pathname,
      lang,
      spaceSlug,
    }) ?? `/${lang}/dho/${spaceSlug}/ecosystem-navigation`
  }/space/create`;

  return (
    <Link
      href={canMutate && !isLoading ? createSpacePath : '#'}
      className={isDisabled ? 'cursor-not-allowed' : 'flex-1 md:flex-none'}
      title={
        isLoading
          ? t('visibleSpaces.loading')
          : !canMutate
          ? t('visibleSpaces.noAccessAddSpace')
          : t('visibleSpaces.addSpace')
      }
    >
      <Button
        variant="default"
        size="default"
        colorVariant="accent"
        className="w-full md:w-auto"
        disabled={isDisabled}
      >
        <PlusIcon className="w-4 h-4" />
        {t('visibleSpaces.addSpace')}
      </Button>
    </Link>
  );
}

export function VisibleSpacesList({
  visibleSpaces,
  allSpaces,
  lang,
  entrySpaceId,
}: VisibleSpacesListProps) {
  const t = useTranslations('SelectNavigationAction');
  const pathname = usePathname();
  const safeAllSpaces = Array.isArray(allSpaces) ? allSpaces : [];
  const [searchQuery, setSearchQuery] = useState('');
  const buildNestedPath = (space: VisibleSpace): string => {
    if (space.root) {
      return t('visibleSpaces.nestedRoot');
    }

    if (space.parentId) {
      const parent = safeAllSpaces.find((s) => s.id === space.parentId);
      if (parent) {
        return t('visibleSpaces.nestedIn', { parent: parent.title });
      }
    }

    return t('visibleSpaces.nested');
  };

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

  if (!rootSpace) {
    return null;
  }

  const rootNestedPath = buildNestedPath(rootSpace);
  const rootVisitSpacePath = rootSpace.slug
    ? getDhoSpaceContextPath({
        pathname,
        lang,
        spaceSlug: rootSpace.slug,
      }) ?? `/${lang}/dho/${rootSpace.slug}/agreements`
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
            <AddSpaceButton
              space={rootSpace}
              allSpaces={safeAllSpaces}
              lang={lang}
            />
            <Link href={rootVisitSpacePath} className="flex-1 md:flex-none">
              <Button
                colorVariant="neutral"
                variant="outline"
                size="default"
                disabled={rootSpace.id === entrySpaceId}
                className="w-full md:w-auto"
              >
                {t('visibleSpaces.visitSpace')}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <Separator />

      <div className="flex gap-2">
        <Input
          placeholder={t('visibleSpaces.searchSpaces')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            // Prevent parent keyboard handlers (e.g. Tabs) from hijacking typing.
            e.stopPropagation();
          }}
          className="flex-1"
        />
      </div>

      <div className="flex flex-col gap-3">
        {filteredSpaces.map((space) => {
          const nestedPath = buildNestedPath(space);
          const visitSpacePath = space.slug
            ? getDhoSpaceContextPath({
                pathname,
                lang,
                spaceSlug: space.slug,
              }) ?? `/${lang}/dho/${space.slug}/agreements`
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
                  <AddSpaceButton
                    space={space}
                    allSpaces={safeAllSpaces}
                    lang={lang}
                  />
                  <Link href={visitSpacePath} className="flex-1 md:flex-none">
                    <Button
                      colorVariant="neutral"
                      variant="outline"
                      size="default"
                      disabled={space.id === entrySpaceId}
                      className="w-full md:w-auto"
                    >
                      {t('visibleSpaces.visitSpace')}
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredSpaces.length === 0 && (
        <div className="text-center text-neutral-11 py-8">
          {t('visibleSpaces.noSpacesFound')}
        </div>
      )}
    </div>
  );
}
