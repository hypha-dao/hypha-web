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

export function SpaceBreadcrumb({ children }: { children: React.ReactNode }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/my-spaces" className="flex items-center">
            <ChevronLeftIcon width={16} height={16} />
            My Spaces
          </BreadcrumbLink>
        </BreadcrumbItem>
        {children}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export const SpaceBreadcrumbItem = ({
  breadcrumb,
}: {
  breadcrumb: SpaceBreadcrumb;
}) => {
  return (
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
  );
};
