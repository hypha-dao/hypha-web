import { Suspense } from 'react';
import {
  AccountRequiredGate,
  MessagesPeopleListSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from './_components/messages-page-frame';

export default function MessagesPage() {
  return (
    <AccountRequiredGate>
      <MessagesPageFrame fillViewport>
        <Suspense fallback={<MessagesPeopleListSkeleton />}>
          <MyConnections section="messages" />
        </Suspense>
      </MessagesPageFrame>
    </AccountRequiredGate>
  );
}
