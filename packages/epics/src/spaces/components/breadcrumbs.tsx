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
  showRoot = true,
}: {
  children?: React.ReactNode;
  rootHref?: string;
  rootLabel?: string;
  /** When false, only `children` items are shown (e.g. full path from root space). */
  showRoot?: boolean;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showRoot ? (
          <BreadcrumbItem>
            <BreadcrumbLink href={rootHref} className="flex items-center">
              {rootLabel}
            </BreadcrumbLink>
          </BreadcrumbItem>
        ) : null}
        {children}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export const SpaceBreadcrumbItem = ({
  breadcrumb,
  lang,
  showSeparator = true,
}: {
  breadcrumb: SpaceBreadcrumb;
  lang?: string;
  /** When false, no leading chevron (use for the first segment in a full-path-only list). */
  showSeparator?: boolean;
}) => {
  return (
    <Fragment key={breadcrumb.slug}>
      {showSeparator ? (
        <BreadcrumbSeparator>
          <ChevronRightIcon width={16} height={16} />
        </BreadcrumbSeparator>
      ) : null}
      <BreadcrumbItem>
        <BreadcrumbLink
          href={`${lang ? `/${lang}` : ''}/dho/${breadcrumb.slug}/agreements`}
          className="flex items-center"
        >
          {breadcrumb.title}
        </BreadcrumbLink>
      </BreadcrumbItem>
    </Fragment>
  );
};
