// import { findSpaceById } from '@hypha-platform/core/server';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@hypha-platform/ui';
import { ChevronLeftIcon } from 'lucide-react';

type Breadcrumb = {
  slug: string;
  title: string;
};

type Breadcrumbs = Breadcrumb[];

export async function SpaceBreadcrumbs({
  breadcrumbs,
}: {
  breadcrumbs: Breadcrumbs;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/my-spaces" className="flex items-center">
            <ChevronLeftIcon width={16} height={16} />
            My Spaces
          </BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbs.map((breadcrumb, index) => (
          <>
            <BreadcrumbSeparator>
              <ChevronLeftIcon width={16} height={16} />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink
                href={`/dho/${breadcrumb.slug}`}
                className="flex items-center"
              >
                {breadcrumb.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
