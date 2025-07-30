import { findParentSpaceById } from '@hypha-platform/core/server';
import { SpaceBreadcrumb, SpaceBreadcrumbItem } from '@hypha-platform/epics';
import { db } from '@hypha-platform/storage-postgres';
import { Fragment } from 'react';

async function RecursiveBreadcrumbItem({
  spaceId,
  depth = 0,
  maxDepth = 2,
}: {
  spaceId: number;
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
          depth={depth + 1}
          maxDepth={maxDepth}
        />
      )}
      <SpaceBreadcrumbItem
        breadcrumb={{ slug: space.slug, title: space.title }}
      />
    </Fragment>
  );
}

export async function Breadcrumbs({ spaceId }: { spaceId: number }) {
  return (
    <SpaceBreadcrumb>
      <RecursiveBreadcrumbItem spaceId={spaceId} />
    </SpaceBreadcrumb>
  );
}
