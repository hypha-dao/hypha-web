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
    <MessagesViewportLock>
      <MessagesPageFrame>
        <AccountRequiredGate>
          <Suspense fallback={<MessagesPeopleListSkeleton />}>
            <MyConnections section="messages" />
          </Suspense>
        </AccountRequiredGate>
      </MessagesPageFrame>
    </MessagesViewportLock>
  );
}
