import { Suspense } from 'react';
import {
  AccountRequiredGate,
  MessagesInboxShellSkeleton,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from './_components/messages-page-frame';
import { SpaceScopedConnections } from './_components/space-scoped-connections';
import { MessagesViewportLock } from './_components/messages-viewport-lock';

type MessagesPageProps = {
  searchParams: Promise<{ space?: string | string[] }>;
};

export default async function MessagesPage({
  searchParams,
}: MessagesPageProps) {
  const params = await searchParams;
  const raw = params.space;
  const spaceSlug = (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;

  return (
    <MessagesViewportLock>
      <MessagesPageFrame spaceSlug={spaceSlug}>
        <AccountRequiredGate loadingFallback={<MessagesInboxShellSkeleton />}>
          <Suspense fallback={<MessagesInboxShellSkeleton />}>
            <SpaceScopedConnections section="messages" />
          </Suspense>
        </AccountRequiredGate>
      </MessagesPageFrame>
    </MessagesViewportLock>
  );
}
