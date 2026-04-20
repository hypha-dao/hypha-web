import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@hypha-platform/ui';
import { ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';
import clsx from 'clsx';

type SpaceBreadcrumb = {
  slug: string;
  title: string;
};

export function SpaceBreadcrumb({
  children,
  rootHref = '/my-spaces',
  rootLabel = 'My Spaces',
  className,
  listClassName,
  rootLinkClassName,
}: {
  children: React.ReactNode;
  rootHref?: string;
  rootLabel?: string;
  className?: string;
  listClassName?: string;
  rootLinkClassName?: string;
}) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className={listClassName}>
        <BreadcrumbItem>
          <BreadcrumbLink
            href={rootHref}
            className={clsx('flex items-center', rootLinkClassName)}
          >
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
  linkClassName,
  separatorClassName,
}: {
  breadcrumb: SpaceBreadcrumb;
  lang?: string;
  linkClassName?: string;
  separatorClassName?: string;
}) => {
  return (
    <Fragment key={breadcrumb.slug}>
      <BreadcrumbSeparator className={separatorClassName}>
        <ChevronRightIcon width={16} height={16} />
      </BreadcrumbSeparator>
      <BreadcrumbItem>
        <BreadcrumbLink
          href={`${lang ? `/${lang}` : ''}/dho/${breadcrumb.slug}/agreements`}
          className={clsx('flex items-center', linkClassName)}
        >
          {breadcrumb.title}
        </BreadcrumbLink>
      </BreadcrumbItem>
    </Fragment>
  );
};
