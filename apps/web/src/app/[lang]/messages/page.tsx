import { Suspense } from 'react';
import {
  AccountRequiredGate,
  MessagesPeopleListSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from './_components/messages-page-frame';

export default function MessagesPage() {
  return (
    <MessagesPageFrame>
      <AccountRequiredGate>
        <Suspense fallback={<MessagesPeopleListSkeleton />}>
          <MyConnections section="messages" />
        </Suspense>
      </AccountRequiredGate>
    </MessagesPageFrame>
  );
}
