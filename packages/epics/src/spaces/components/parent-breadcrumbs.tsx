import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@hypha-platform/ui';
import { ChevronLeftIcon } from 'lucide-react';
import { Fragment } from 'react';

type SpaceBreadcrumb = {
  slug: string;
  title: string;
};

type SpaceBreadcrumbs = SpaceBreadcrumb[];

export function SpaceBreadcrumbs({
  breadcrumbs,
}: {
  breadcrumbs: SpaceBreadcrumbs;
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
        {breadcrumbs.map((breadcrumb) => (
          <Fragment key={breadcrumb.slug}>
            <BreadcrumbSeparator>
              <ChevronLeftIcon width={16} height={16} />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink
                href={`/dho/${breadcrumb.slug}/governance`}
                className="flex items-center"
              >
                {breadcrumb.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
