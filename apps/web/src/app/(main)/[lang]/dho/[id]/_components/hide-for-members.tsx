'use client';

import type { ReactNode } from 'react';
import { useMemberExperience } from '@hypha-platform/epics';

/** Members are already inside their space. Builders and funders keep this chrome. */
export function HideForMembers({ children }: { children: ReactNode }) {
  const { isMember } = useMemberExperience();
  if (isMember) return null;
  return children;
}
