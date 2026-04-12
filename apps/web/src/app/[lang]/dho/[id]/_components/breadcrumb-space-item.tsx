'use client';

import { SpaceBreadcrumbItem } from '@hypha-platform/epics';
import { useBreadcrumbFrom } from './breadcrumbs-root-selector';

export function BreadcrumbSpaceItem({
  breadcrumb,
  lang,
}: {
  breadcrumb: { slug: string; title: string };
  lang: string;
}) {
  const fromQuery = useBreadcrumbFrom();
  return (
    <SpaceBreadcrumbItem
      breadcrumb={breadcrumb}
      lang={lang}
      fromQuery={fromQuery}
    />
  );
}
