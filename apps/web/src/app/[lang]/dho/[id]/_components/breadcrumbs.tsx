import { findParentSpaceById } from '@hypha-platform/core/server';
import { SpaceBreadcrumb, SpaceBreadcrumbItem } from '@hypha-platform/epics';
import { db } from '@hypha-platform/storage-postgres';
import { Fragment } from 'react';

async function RecursiveBreadcrumbItem({ spaceId }: { spaceId: number }) {
  const space = await findParentSpaceById({ id: spaceId }, { db });
  if (!space) return null;

  return (
    <Fragment key={space.id}>
      {space.parentId && <RecursiveBreadcrumbItem spaceId={space.parentId} />}
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
