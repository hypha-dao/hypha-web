import { Suspense } from 'react';
import {
  AccountRequiredGate,
  MessagesPeopleListSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from '../_components/messages-page-frame';
import { MessagesViewportLock } from '../_components/messages-viewport-lock';

export default function MessagesArchivedPage() {
  return (
    <MessagesViewportLock>
      <MessagesPageFrame heading="archived" fillViewport>
        <AccountRequiredGate>
          <Suspense fallback={<MessagesPeopleListSkeleton />}>
            <MyConnections section="archived" />
          </Suspense>
        </AccountRequiredGate>
      </MessagesPageFrame>
    </MessagesViewportLock>
  );
}
