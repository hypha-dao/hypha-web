import { findParentSpaceById } from '@hypha-platform/core/server';
import { SpaceBreadcrumb, SpaceBreadcrumbItem } from '@hypha-platform/epics';
import { db } from '@hypha-platform/storage-postgres';
import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { Fragment } from 'react';

export type BreadcrumbSegment = { slug: string; title: string };

/** Root → leaf chain for sticky header / client mirrors */
const BREADCRUMB_TRAIL_MAX_DEPTH = 32;

export async function getSpaceBreadcrumbTrail(
  spaceId: number,
): Promise<BreadcrumbSegment[]> {
  const leafUp: BreadcrumbSegment[] = [];
  let id: number | null | undefined = spaceId;
  const seen = new Set<number>();

  while (id && leafUp.length < BREADCRUMB_TRAIL_MAX_DEPTH) {
    if (seen.has(id)) break;
    seen.add(id);

    const row = await findParentSpaceById({ id }, { db });
    if (!row) break;
    leafUp.push({
      slug: row.slug as string,
      title: row.title as string,
    });
    id = row.parentId ?? null;
  }

  return leafUp.reverse();
}

async function RecursiveBreadcrumbItem({
  spaceId,
  lang,
  depth = 0,
  maxDepth = 2,
  linkClassName,
  separatorClassName,
}: {
  spaceId: number;
  lang: Locale;
  depth?: number;
  maxDepth?: number;
  linkClassName?: string;
  separatorClassName?: string;
}) {
  console.debug('RecursiveBreadcrumbItem', { spaceId, depth, maxDepth });
  const space = await findParentSpaceById({ id: spaceId }, { db });
  if (!space || depth > maxDepth) return null;

  return (
    <Fragment key={space.id}>
      {space.parentId && (
        <RecursiveBreadcrumbItem
          spaceId={space.parentId}
          lang={lang}
          depth={depth + 1}
          maxDepth={maxDepth}
          linkClassName={linkClassName}
          separatorClassName={separatorClassName}
        />
      )}
      <SpaceBreadcrumbItem
        lang={lang}
        breadcrumb={{ slug: space.slug, title: space.title }}
        linkClassName={linkClassName}
        separatorClassName={separatorClassName}
      />
    </Fragment>
  );
}

const HERO_BREADCRUMB_ROOT_LINK =
  'text-[11px] font-medium leading-tight text-white/90 hover:text-white';
const HERO_BREADCRUMB_LINK =
  'text-[11px] font-medium leading-tight text-white/90 hover:text-white';
const HERO_BREADCRUMB_LIST =
  'gap-1 text-[11px] leading-tight text-white/75 [&_[data-slot=breadcrumb-separator]]:text-white/45';

export async function Breadcrumbs({
  spaceId,
  lang,
  variant = 'default',
}: {
  spaceId: number;
  lang: Locale;
  variant?: 'default' | 'heroOverlay';
}) {
  const tNavigation = await getTranslations('Navigation');

  const isHero = variant === 'heroOverlay';

  return (
    <SpaceBreadcrumb
      rootHref={`/${lang}/my-spaces`}
      rootLabel={tNavigation('mySpaces')}
      listClassName={isHero ? HERO_BREADCRUMB_LIST : undefined}
      rootLinkClassName={isHero ? HERO_BREADCRUMB_ROOT_LINK : undefined}
    >
      <RecursiveBreadcrumbItem
        spaceId={spaceId}
        lang={lang}
        linkClassName={isHero ? HERO_BREADCRUMB_LINK : undefined}
        separatorClassName={
          isHero ? '[&>svg]:size-3 [&>svg]:text-white/45' : undefined
        }
      />
    </SpaceBreadcrumb>
  );
}
