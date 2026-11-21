'use client';

import { useSearchParams } from 'next/navigation';
import { MyConnections } from '@hypha-platform/epics';

export function SpaceScopedConnections({
  section,
}: {
  section: 'messages' | 'suggestions' | 'archived';
}) {
  const spaceSlug = useSearchParams().get('space')?.trim() || undefined;
  return <MyConnections section={section} spaceSlug={spaceSlug} />;
}
