import { Suspense } from 'react';
import {
  AccountRequiredGate,
  MessagesPeopleListSkeleton,
  MyConnections,
} from '@hypha-platform/epics';

import { MessagesPageFrame } from '../_components/messages-page-frame';

export default function MessagesArchivedPage() {
  return (
    <MessagesPageFrame heading="archived">
      <AccountRequiredGate>
        <Suspense fallback={<MessagesPeopleListSkeleton />}>
          <MyConnections section="archived" />
        </Suspense>
      </AccountRequiredGate>
    </MessagesPageFrame>
  );
}
