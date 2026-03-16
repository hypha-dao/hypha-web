import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@hypha-platform/ui';
import { ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';

type SpaceBreadcrumb = {
  slug: string;
  title: string;
};

export function SpaceBreadcrumb({
  children,
  rootHref = '/my-spaces',
  rootLabel = 'My Spaces',
}: {
  children: React.ReactNode;
  rootHref?: string;
  rootLabel?: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={rootHref} className="flex items-center">
            {rootLabel}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {children}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export const SpaceBreadcrumbItem = ({
  breadcrumb,
  lang,
  fromQuery,
}: {
  breadcrumb: SpaceBreadcrumb;
  lang?: string;
  /** Query string to append for breadcrumb origin (e.g. "from=network") */
  fromQuery?: string;
}) => {
  const baseHref = `${lang ? `/${lang}` : ''}/dho/${breadcrumb.slug}/agreements`;
  const href = fromQuery ? `${baseHref}?${fromQuery}` : baseHref;
  return (
    <Fragment key={breadcrumb.slug}>
      <BreadcrumbSeparator>
        <ChevronRightIcon width={16} height={16} />
      </BreadcrumbSeparator>
      <BreadcrumbItem>
        <BreadcrumbLink href={href} className="flex items-center">
          {breadcrumb.title}
        </BreadcrumbLink>
      </BreadcrumbItem>
    </Fragment>
  );
};
