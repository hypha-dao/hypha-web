'use client';

import { GlobalCallDockOverlay } from '@hypha-platform/epics';
import { useMembers } from '../hooks/use-members';

export function ConnectedGlobalCallDock() {
  return <GlobalCallDockOverlay useMembers={useMembers} />;
}
