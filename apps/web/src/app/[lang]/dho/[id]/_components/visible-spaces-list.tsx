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
import {
  useSpaceDiscoverability,
  useUserSpaceState,
  checkAccess,
} from '@hypha-platform/epics';
import type { VisibleSpace } from './types';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

type VisibleSpacesListProps = {
  visibleSpaces: VisibleSpace[];
  allSpaces: Space[];
  lang: Locale;
  entrySpaceId?: number;
  /** Tight, scrollable column when shown beside the map (Ecosystem). */
  variant?: 'default' | 'ecosystemPanel';
  className?: string;
};

type AddSpaceButtonProps = {
  space: VisibleSpace;
  allSpaces: Space[];
  lang: Locale;
  /** Compact controls for the Ecosystem side panel (avoids layout collision with title). */
  size?: 'default' | 'sm';
  className?: string;
};

function AddSpaceButton({
  space,
  allSpaces,
  lang,
  size = 'default',
  className,
}: AddSpaceButtonProps) {
  const t = useTranslations('SelectNavigationAction');
  const fullSpace = allSpaces.find((s) => s.id === space.id);
  const web3SpaceId = fullSpace?.web3SpaceId;
  const spaceSlug = fullSpace?.slug || space.slug;
  const hasSpaceInfo = !!web3SpaceId && !!spaceSlug;

  const { access, isLoading: isAccessLoading } = useSpaceDiscoverability({
    spaceId: web3SpaceId ? BigInt(web3SpaceId) : undefined,
  });

  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceId: typeof web3SpaceId === 'number' ? web3SpaceId : undefined,
    spaceSlug,
    space: fullSpace,
  });

  const btnClass = cn('w-full sm:w-auto shrink-0', className);

  if (!hasSpaceInfo) {
    return (
      <Button
        variant="default"
        size={size}
        colorVariant="accent"
        className={btnClass}
        disabled={true}
        title={t('visibleSpaces.spaceInfoNotAvailable')}
      >
        <PlusIcon className="h-3.5 w-3.5" />
        {t('visibleSpaces.addSpace')}
      </Button>
    );
  }

  const hasAccess = checkAccess(access, userState);
  const isLoading = isAccessLoading || isUserStateLoading;
  const isDisabled = isLoading || !hasAccess;

  const createSpacePath = `/${lang}/dho/${spaceSlug}/space/create`;

  return (
    <Link
      href={hasAccess && !isLoading ? createSpacePath : '#'}
      className={isDisabled ? 'cursor-not-allowed' : 'w-full min-w-0 sm:w-auto'}
      title={
        isLoading
          ? t('visibleSpaces.loading')
          : !hasAccess
          ? t('visibleSpaces.noAccessAddSpace')
          : t('visibleSpaces.addSpace')
      }
    >
      <Button
        variant="default"
        size={size}
        colorVariant="accent"
        className={btnClass}
        disabled={isDisabled}
      >
        <PlusIcon className="h-3.5 w-3.5" />
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
  variant = 'default',
  className,
}: VisibleSpacesListProps) {
  const t = useTranslations('SelectNavigationAction');
  const isPanel = variant === 'ecosystemPanel';
  const [searchQuery, setSearchQuery] = useState('');
  const buildNestedPath = (space: VisibleSpace): string => {
    if (space.root) {
      return t('visibleSpaces.nestedRoot');
    }

    if (space.parentId) {
      const parent = allSpaces.find((s) => s.id === space.parentId);
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
    ? getDhoPathAgreements(lang, rootSpace.slug)
    : '#';

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-col',
        isPanel ? 'h-full min-h-0 max-h-full gap-0 overflow-hidden' : 'gap-4',
        className,
      )}
      data-testid="dho-ecosystem-spaces-list"
    >
      <div
        className={cn(
          'shrink-0',
          isPanel
            ? 'space-y-2.5 border-b border-border/40 pb-2.5'
            : 'space-y-0',
        )}
      >
        <div className="flex min-w-0 items-center justify-between gap-2">
          {isPanel ? (
            <h3 className="min-w-0 text-left text-0 font-medium uppercase leading-none tracking-wide text-muted-foreground">
              {t('visibleSpaces.panelListHeading')}
            </h3>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t('visibleSpaces.searchSpaces')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 flex-1 text-1"
            data-testid="dho-ecosystem-spaces-search"
          />
        </div>
      </div>

      {isPanel ? null : <Separator />}

      <div
        className={cn(
          'min-h-0 w-full',
          isPanel
            ? 'flex flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pr-0.5 pt-2.5 [scrollbar-gutter:stable] narrow-scrollbar'
            : 'flex flex-col gap-3',
        )}
      >
        <Card
          className={cn('border-border/60 p-0 shadow-sm', isPanel && 'p-0')}
        >
          <div
            className={cn(
              'p-2.5',
              isPanel
                ? 'flex flex-col gap-2.5 sm:flex-col'
                : 'flex flex-col gap-4 md:flex-row md:items-center',
            )}
          >
            <div
              className={cn(
                'flex min-w-0',
                isPanel
                  ? 'w-full min-w-0 items-start gap-2.5 sm:min-w-0 sm:max-w-full'
                  : 'min-w-0 flex-1 items-center gap-4',
              )}
            >
              <Avatar
                className={cn(
                  'flex-shrink-0',
                  isPanel ? 'h-9 w-9' : 'h-12 w-12',
                )}
              >
                <AvatarImage
                  src={rootSpace.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                  alt={`${rootSpace.name} logo`}
                />
              </Avatar>
              <div
                className="min-w-0 flex-1 [overflow-wrap:anywhere]"
                style={{ minWidth: 0 }}
              >
                <p
                  className={cn(
                    'font-medium leading-snug text-foreground',
                    isPanel ? 'text-0 sm:text-1' : 'mb-1 text-base',
                  )}
                >
                  {rootSpace.name}
                </p>
                <Badge
                  variant="outline"
                  size={1}
                  colorVariant="neutral"
                  className="mt-1 w-fit max-w-full whitespace-normal break-words text-0"
                >
                  {rootNestedPath}
                </Badge>
              </div>
            </div>
            {isPanel ? null : <Separator className="my-1" />}
            <div
              className={cn(
                isPanel
                  ? 'grid min-w-0 w-full gap-1.5 [grid-template-columns:minmax(0,1fr)] sm:grid-cols-2 [min-width:0]'
                  : 'flex w-full min-w-0 flex-wrap items-center justify-end gap-2',
              )}
            >
              {isPanel ? (
                <>
                  <AddSpaceButton
                    space={rootSpace}
                    allSpaces={allSpaces}
                    lang={lang}
                    size="sm"
                    className="w-full min-w-0"
                  />
                  <Link href={rootVisitSpacePath} className="min-w-0">
                    <Button
                      colorVariant="neutral"
                      variant="outline"
                      size="sm"
                      disabled={rootSpace.id === entrySpaceId}
                      className="w-full"
                    >
                      {t('visibleSpaces.visitSpace')}
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <AddSpaceButton
                    space={rootSpace}
                    allSpaces={allSpaces}
                    lang={lang}
                  />
                  <Link href={rootVisitSpacePath} className="w-full sm:w-auto">
                    <Button
                      colorVariant="neutral"
                      variant="outline"
                      size="default"
                      disabled={rootSpace.id === entrySpaceId}
                      className="w-full sm:w-auto"
                    >
                      {t('visibleSpaces.visitSpace')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </Card>
        {filteredSpaces.map((space) => {
          const nestedPath = buildNestedPath(space);
          const visitSpacePath = space.slug
            ? getDhoPathAgreements(lang, space.slug)
            : '#';

          return (
            <Card
              key={space.id}
              className={cn('border-border/60 p-0 shadow-sm', isPanel && 'p-0')}
            >
              <div
                className={cn(
                  'p-2.5',
                  isPanel
                    ? 'flex flex-col gap-2.5'
                    : 'flex flex-col gap-4 md:flex-row md:items-center',
                )}
              >
                <div
                  className={cn(
                    'flex min-w-0',
                    isPanel
                      ? 'w-full items-start gap-2.5'
                      : 'min-w-0 flex-1 items-center gap-4',
                  )}
                >
                  <Avatar
                    className={cn(
                      'flex-shrink-0',
                      isPanel ? 'h-9 w-9' : 'h-12 w-12',
                    )}
                  >
                    <AvatarImage
                      src={space.logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
                      alt={`${space.name} logo`}
                    />
                  </Avatar>

                  <div
                    className="min-w-0 flex-1 [overflow-wrap:anywhere]"
                    style={{ minWidth: 0 }}
                  >
                    <p
                      className={cn(
                        'font-medium leading-snug text-foreground',
                        isPanel ? 'text-0 sm:text-1' : 'mb-1 text-base',
                      )}
                    >
                      {space.name}
                    </p>
                    <Badge
                      variant="outline"
                      size={1}
                      colorVariant="neutral"
                      className="mt-1 w-fit max-w-full whitespace-normal break-words text-0"
                    >
                      {nestedPath}
                    </Badge>
                  </div>
                </div>
                {isPanel ? null : <Separator className="my-1" />}
                <div
                  className={cn(
                    'w-full min-w-0',
                    isPanel
                      ? 'mt-0.5 flex w-full min-w-0 flex-col gap-1.5'
                      : 'flex w-full flex-wrap items-center justify-end gap-2',
                  )}
                >
                  {!isPanel && (
                    <>
                      <AddSpaceButton
                        space={space}
                        allSpaces={allSpaces}
                        lang={lang}
                      />
                      <Link href={visitSpacePath} className="w-full sm:w-auto">
                        <Button
                          colorVariant="neutral"
                          variant="outline"
                          size="default"
                          disabled={space.id === entrySpaceId}
                          className="w-full sm:w-auto"
                        >
                          {t('visibleSpaces.visitSpace')}
                        </Button>
                      </Link>
                    </>
                  )}
                  {isPanel && (
                    <div className="grid min-w-0 w-full gap-1.5 [grid-template-columns:minmax(0,1fr)] sm:grid-cols-2 [min-width:0]">
                      <AddSpaceButton
                        space={space}
                        allSpaces={allSpaces}
                        lang={lang}
                        size="sm"
                        className="w-full min-w-0 justify-center sm:min-w-0"
                      />
                      <Link
                        href={visitSpacePath}
                        className="w-full min-w-0 sm:min-w-0"
                      >
                        <Button
                          colorVariant="neutral"
                          variant="outline"
                          size="sm"
                          disabled={space.id === entrySpaceId}
                          className="w-full min-w-0 justify-center sm:min-w-0"
                        >
                          {t('visibleSpaces.visitSpace')}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {filteredSpaces.length === 0 && (
          <div className="text-center text-0 text-neutral-11">
            {t('visibleSpaces.noSpacesFound')}
          </div>
        )}
      </div>
    </div>
  );
}
