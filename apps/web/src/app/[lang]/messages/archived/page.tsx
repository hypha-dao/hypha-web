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
      <MessagesPageFrame heading="archived">
        <AccountRequiredGate>
          <Suspense fallback={<MessagesPeopleListSkeleton />}>
            <MyConnections section="archived" />
          </Suspense>
        </AccountRequiredGate>
      </MessagesPageFrame>
    </MessagesViewportLock>
  );
}
