import { findParentSpaceById } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { Locale } from '@hypha-platform/i18n';
import { Fragment } from 'react';
import { BreadcrumbsRootSelector } from './breadcrumbs-root-selector';
import { BreadcrumbSpaceItem } from './breadcrumb-space-item';

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
      <BreadcrumbSpaceItem
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
  return (
    <BreadcrumbsRootSelector>
      <RecursiveBreadcrumbItem spaceId={spaceId} lang={lang} />
    </BreadcrumbsRootSelector>
  );
}
