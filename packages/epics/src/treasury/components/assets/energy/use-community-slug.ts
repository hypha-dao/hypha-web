'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { getDhoSpaceSlugFromPathname } from '../../../../common/get-dho-space-slug-from-pathname';

/** Current DHO space slug derived from the pathname (`/{lang}/dho/{slug}/...`). */
export const useCommunitySlug = (): string | undefined => {
  const pathname = usePathname();
  return React.useMemo(() => getDhoSpaceSlugFromPathname(pathname), [pathname]);
};
