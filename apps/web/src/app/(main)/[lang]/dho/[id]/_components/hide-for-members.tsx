'use client';

import type { ReactNode } from 'react';
import { useMe } from '@hypha-platform/core/client';
import { isMemberOrientation } from '@hypha-platform/epics';

/** Members are already inside their space. Builders and funders keep this chrome. */
export function HideForMembers({ children }: { children: ReactNode }) {
  const { person } = useMe();
  if (isMemberOrientation(person?.primaryOrientation)) return null;
  return children;
}
