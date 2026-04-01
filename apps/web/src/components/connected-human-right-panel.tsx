'use client';

import { HumanRightPanel } from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';

export function ConnectedHumanRightPanel() {
  return <HumanRightPanel useMembers={useMembers} />;
}
