'use client';

import { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Locale } from '@hypha-platform/i18n';
import {
  buildOverviewDrillDownPath,
  type OverviewDrillDown,
} from './overview-drill-down';

export function useOverviewDrillDown(spaceSlug: string) {
  const router = useRouter();
  const { lang } = useParams<{ lang: Locale }>();

  return useCallback(
    (drillDown: OverviewDrillDown) => {
      router.push(buildOverviewDrillDownPath(lang, spaceSlug, drillDown));
    },
    [lang, router, spaceSlug],
  );
}
