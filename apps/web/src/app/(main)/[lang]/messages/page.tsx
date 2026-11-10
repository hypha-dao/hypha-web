import { Suspense } from 'react';
import {
  AccountRequiredGate,
  MessagesInboxShellSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from './_components/messages-page-frame';
import { MessagesViewportLock } from './_components/messages-viewport-lock';

export default function MessagesPage() {
  return (
    <MessagesViewportLock>
      <MessagesPageFrame>
        <AccountRequiredGate loadingFallback={<MessagesInboxShellSkeleton />}>
          <Suspense fallback={<MessagesInboxShellSkeleton />}>
            <MyConnections section="messages" />
          </Suspense>
        </AccountRequiredGate>
      </MessagesPageFrame>
    </MessagesViewportLock>
  );
}
