import { findParentSpaceById } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@hypha-platform/ui';
import { ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';

type SpaceCrumb = {
  id: number;
  slug: string;
  title: string;
  parentId: number | null;
};

async function getSpaceChain(spaceId: number): Promise<SpaceCrumb[]> {
  const chain: SpaceCrumb[] = [];
  const seen = new Set<number>();
  let cursorId: number | null = spaceId;
  while (cursorId != null && !seen.has(cursorId)) {
    seen.add(cursorId);
    const space = await findParentSpaceById({ id: cursorId }, { db });
    if (!space) break;
    chain.push({
      id: space.id,
      slug: space.slug,
      title: space.title,
      parentId: space.parentId ?? null,
    });
    cursorId = space.parentId ?? null;
  }

  // We gathered from leaf->root; UI needs root->leaf.
  return chain.reverse();
}

function getVisibleCrumbs(chain: SpaceCrumb[]): Array<SpaceCrumb | 'ellipsis'> {
  // Keep full path up to 6 levels; collapse the middle for deeper trees.
  if (chain.length <= 6) return chain;
  return [...chain.slice(0, 2), 'ellipsis', ...chain.slice(-3)];
}

export async function Breadcrumbs({
  spaceId,
  lang,
}: {
  spaceId: number;
  lang: Locale;
}) {
  const chain = await getSpaceChain(spaceId);
  const visibleCrumbs = getVisibleCrumbs(chain);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {visibleCrumbs.map((crumb, index) => (
          <Fragment
            key={
              crumb === 'ellipsis' ? `ellipsis-${index}` : `crumb-${crumb.id}`
            }
          >
            {index > 0 ? (
              <BreadcrumbSeparator>
                <ChevronRightIcon width={16} height={16} />
              </BreadcrumbSeparator>
            ) : null}
            <BreadcrumbItem>
              {crumb === 'ellipsis' ? (
                <BreadcrumbEllipsis className="size-4" />
              ) : index === visibleCrumbs.length - 1 ? (
                <span
                  aria-current="page"
                  className="inline-block max-w-[9rem] truncate align-bottom sm:max-w-[12rem]"
                  title={crumb.title}
                >
                  {crumb.title}
                </span>
              ) : (
                <BreadcrumbLink asChild>
                  <Link
                    href={`/${lang}/dho/${crumb.slug}/agreements`}
                    className="inline-block max-w-[9rem] truncate align-bottom sm:max-w-[12rem]"
                    title={crumb.title}
                  >
                    {crumb.title}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
