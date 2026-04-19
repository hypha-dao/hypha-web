import { findParentSpaceById } from '@hypha-platform/core/server';
import { SpaceBreadcrumb, SpaceBreadcrumbItem } from '@hypha-platform/epics';
import { db } from '@hypha-platform/storage-postgres';
import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { Fragment } from 'react';

export type BreadcrumbSegment = { slug: string; title: string };

/** Root → leaf chain for sticky header / client mirrors */
export async function getSpaceBreadcrumbTrail(
  spaceId: number,
): Promise<BreadcrumbSegment[]> {
  const leafUp: BreadcrumbSegment[] = [];
  let id: number | null | undefined = spaceId;

  while (id) {
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
}: {
  spaceId: number;
  lang: Locale;
  depth?: number;
  maxDepth?: number;
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
        />
      )}
      <SpaceBreadcrumbItem
        lang={lang}
        breadcrumb={{ slug: space.slug, title: space.title }}
      />
    </Fragment>
  );
}

export async function Breadcrumbs({
  spaceId,
  lang,
}: {
  spaceId: number;
  lang: Locale;
}) {
  const tNavigation = await getTranslations('Navigation');

  return (
    <SpaceBreadcrumb
      rootHref={`/${lang}/my-spaces`}
      rootLabel={tNavigation('mySpaces')}
    >
      <RecursiveBreadcrumbItem spaceId={spaceId} lang={lang} />
    </SpaceBreadcrumb>
  );
}
