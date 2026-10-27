import { Suspense } from 'react';
import {
  AccountRequiredGate,
  MessagesPeopleListSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from './_components/messages-page-frame';
import { MessagesViewportLock } from './_components/messages-viewport-lock';

export default function MessagesPage() {
  return (
    <AccountRequiredGate>
      <MessagesViewportLock>
        <MessagesPageFrame fillViewport>
          <Suspense fallback={<MessagesPeopleListSkeleton />}>
            <MyConnections section="messages" />
          </Suspense>
        </MessagesPageFrame>
      </MessagesViewportLock>
    </AccountRequiredGate>
  );
}
